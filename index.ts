import * as fs from "fs";
import * as crypto from "crypto";
import * as path from "path";
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { lookup as lookupMimeType } from "mime-types";

const projectName = pulumi.getProject();
const stackName = pulumi.getStack();
const config = new pulumi.Config();

const sitePath = config.get("sitePath") ?? "../cn-navigator/dist";
const indexDocument = config.get("indexDocument") ?? "index.html";
const errorDocument = config.get("errorDocument") ?? indexDocument;
const priceClass = config.get("priceClass") ?? "PriceClass_200";
const excludedExtensions = new Set([".map"]);

const siteRoot = path.resolve(sitePath);
if (!fs.existsSync(siteRoot)) {
  throw new Error(`Site path does not exist: ${siteRoot}`);
}

const bucket = new aws.s3.BucketV2("site-bucket", {
  bucketPrefix: `${projectName}-${stackName}-`,
});

new aws.s3.BucketPublicAccessBlock("site-public-access-block", {
  bucket: bucket.id,
  blockPublicAcls: true,
  blockPublicPolicy: true,
  ignorePublicAcls: true,
  restrictPublicBuckets: true,
});

new aws.s3.BucketOwnershipControls("site-ownership-controls", {
  bucket: bucket.id,
  rule: {
    objectOwnership: "BucketOwnerEnforced",
  },
});

const originAccessControl = new aws.cloudfront.OriginAccessControl("site-oac", {
  description: `${projectName}-${stackName} S3 origin access control`,
  originAccessControlOriginType: "s3",
  signingBehavior: "always",
  signingProtocol: "sigv4",
});

const distribution = new aws.cloudfront.Distribution("site-cdn", {
  enabled: true,
  isIpv6Enabled: true,
  defaultRootObject: indexDocument,
  priceClass,
  origins: [
    {
      originId: bucket.arn,
      domainName: bucket.bucketRegionalDomainName,
      originAccessControlId: originAccessControl.id,
    },
  ],
  defaultCacheBehavior: {
    targetOriginId: bucket.arn,
    viewerProtocolPolicy: "redirect-to-https",
    allowedMethods: ["GET", "HEAD", "OPTIONS"],
    cachedMethods: ["GET", "HEAD", "OPTIONS"],
    compress: true,
    forwardedValues: {
      queryString: false,
      cookies: {
        forward: "none",
      },
    },
    minTtl: 0,
    defaultTtl: 3600,
    maxTtl: 86400,
  },
  customErrorResponses: [
    {
      errorCode: 403,
      responseCode: 200,
      responsePagePath: `/${errorDocument}`,
      errorCachingMinTtl: 0,
    },
    {
      errorCode: 404,
      responseCode: 200,
      responsePagePath: `/${errorDocument}`,
      errorCachingMinTtl: 0,
    },
  ],
  restrictions: {
    geoRestriction: {
      restrictionType: "none",
    },
  },
  viewerCertificate: {
    cloudfrontDefaultCertificate: true,
  },
});

new aws.s3.BucketPolicy("site-bucket-policy", {
  bucket: bucket.id,
  policy: pulumi
    .all([bucket.arn, distribution.arn])
    .apply(([bucketArn, distributionArn]) =>
      JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "AllowCloudFrontServicePrincipalReadOnly",
            Effect: "Allow",
            Principal: {
              Service: "cloudfront.amazonaws.com",
            },
            Action: "s3:GetObject",
            Resource: `${bucketArn}/*`,
            Condition: {
              StringEquals: {
                "AWS:SourceArn": distributionArn,
              },
            },
          },
        ],
      }),
    ),
});

for (const filePath of listFiles(siteRoot)) {
  const relativePath = path.relative(siteRoot, filePath);
  const objectKey = relativePath.split(path.sep).join("/");
  const contentType = lookupMimeType(filePath) || "application/octet-stream";

  new aws.s3.BucketObjectv2(
    `site-object-${stableResourceName(objectKey)}`,
    {
      bucket: bucket.id,
      key: objectKey,
      source: new pulumi.asset.FileAsset(filePath),
      contentType,
      cacheControl: cacheControlFor(objectKey),
    },
  );
}

export const bucketName = bucket.bucket;
export const cloudFrontDistributionId = distribution.id;
export const cloudFrontDomainName = distribution.domainName;
export const siteUrl = pulumi.interpolate`https://${distribution.domainName}`;

function listFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return listFiles(entryPath);
    }

    if (entry.isFile()) {
      return shouldUploadFile(entryPath) ? [entryPath] : [];
    }

    return [];
  });
}

function shouldUploadFile(filePath: string): boolean {
  const fileName = path.basename(filePath);

  if (fileName.startsWith(".")) {
    return false;
  }

  return !excludedExtensions.has(path.extname(filePath));
}

function cacheControlFor(objectKey: string): string {
  if (objectKey === indexDocument || objectKey.endsWith(".html")) {
    return "no-cache";
  }

  if (objectKey.startsWith("assets/")) {
    return "public, max-age=31536000, immutable";
  }

  return "public, max-age=3600";
}

function stableResourceName(objectKey: string): string {
  const readableName = objectKey
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const uniqueSuffix = crypto
    .createHash("sha1")
    .update(objectKey)
    .digest("hex")
    .slice(0, 10);

  return `${readableName}-${uniqueSuffix}`;
}

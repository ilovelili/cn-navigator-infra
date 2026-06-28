# cn-navigator-infra

Pulumi TypeScript infrastructure for hosting the `cn-navigator` Vite build on S3 behind CloudFront.

## Prerequisites

- Node.js and npm
- Pulumi CLI
- AWS credentials for the target account

## Usage

```sh
make install
make stack STACK=dev
make config STACK=dev AWS_REGION=ap-northeast-1 SITE_PATH=../cn-navigator/dist
make deploy STACK=dev
```

Useful outputs:

```sh
make outputs STACK=dev
```

The default app source directory is `../cn-navigator`, and the default deployed artifact path is `../cn-navigator/dist`.

SHELL := /bin/bash

APP_DIR ?= ../cn-logistics
SITE_PATH ?= $(APP_DIR)/dist
STACK ?= prod
AWS_REGION ?= ap-northeast-1
AWS_PROFILE ?= cn-navigator
PULUMI_OWNER ?= ilovelili
CUSTOM_DOMAIN ?= navigator.cnlogistics.co.jp
CERTIFICATE_ARN ?= arn:aws:acm:us-east-1:759880858613:certificate/f921c9c4-b22c-4df4-a395-fd19fd35513a
PULUMI_STACK := $(PULUMI_OWNER)/$(STACK)

.PHONY: help install stack config build-app preview up deploy destroy refresh outputs typecheck clean

help:
	@printf "Targets:\n"
	@printf "  make install      Install Node dependencies for Pulumi program\n"
	@printf "  make stack        Select or create the Pulumi stack ($(PULUMI_STACK))\n"
	@printf "  make config       Set default stack config values\n"
	@printf "                    CUSTOM_DOMAIN and CERTIFICATE_ARN have production defaults\n"
	@printf "  make build-app    Build the source app in $(APP_DIR)\n"
	@printf "  make typecheck    Typecheck the Pulumi program\n"
	@printf "  make preview      Preview infrastructure changes\n"
	@printf "  make up           Apply infrastructure changes\n"
	@printf "  make deploy       Build app, configure stack, and deploy\n"
	@printf "  make destroy      Destroy the stack resources\n"
	@printf "  make refresh      Refresh stack state\n"
	@printf "  make outputs      Show stack outputs\n"
	@printf "  make clean        Remove generated local artifacts\n"

install:
	pnpm install

stack:
	pulumi stack select $(PULUMI_STACK) || pulumi stack init $(PULUMI_STACK)

config: stack
	pulumi config set aws:region $(AWS_REGION)
	pulumi config set aws:profile $(AWS_PROFILE)
	pulumi config set sitePath $(SITE_PATH)
	@if [[ -n "$(CERTIFICATE_ARN)" ]]; then \
		pulumi config set customDomain "$(CUSTOM_DOMAIN)"; \
		pulumi config set certificateArn "$(CERTIFICATE_ARN)"; \
	fi

build-app:
	cd $(APP_DIR) && pnpm build

typecheck:
	pnpm typecheck

preview: config
	pulumi preview

up: config
	pulumi up

deploy: build-app
	$(MAKE) up

destroy: stack
	pulumi destroy

refresh: stack
	pulumi refresh

outputs: stack
	pulumi stack output

clean:
	rm -rf bin

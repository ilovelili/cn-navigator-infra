SHELL := /bin/bash

APP_DIR ?= ../cn-navigator
SITE_PATH ?= $(APP_DIR)/dist
STACK ?= dev
AWS_REGION ?= ap-northeast-1
AWS_PROFILE ?= cn-logistics
PULUMI_OWNER ?= ilovelili
PULUMI_STACK := $(PULUMI_OWNER)/$(STACK)

.PHONY: help install stack config build-app preview up deploy destroy refresh outputs typecheck clean

help:
	@printf "Targets:\n"
	@printf "  make install      Install Node dependencies for Pulumi program\n"
	@printf "  make stack        Select or create the Pulumi stack ($(PULUMI_STACK))\n"
	@printf "  make config       Set default stack config values\n"
	@printf "  make build-app    Build the source app in $(APP_DIR)\n"
	@printf "  make preview      Preview infrastructure changes\n"
	@printf "  make up           Apply infrastructure changes\n"
	@printf "  make deploy       Build app, configure stack, and deploy\n"
	@printf "  make destroy      Destroy the stack resources\n"
	@printf "  make outputs      Show stack outputs\n"

install:
	npm install

stack:
	pulumi stack select $(PULUMI_STACK) || pulumi stack init $(PULUMI_STACK)

config: stack
	pulumi config set aws:region $(AWS_REGION)
	pulumi config set aws:profile $(AWS_PROFILE)
	pulumi config set sitePath $(SITE_PATH)

build-app:
	cd $(APP_DIR) && npm run build

typecheck:
	npm run typecheck

preview: config
	pulumi preview

up: config
	pulumi up

deploy: build-app up

destroy: stack
	pulumi destroy

refresh: stack
	pulumi refresh

outputs: stack
	pulumi stack output

clean:
	rm -rf bin

#!/bin/bash

set -eu

vsce package --allow-missing-repository
code --install-extension ./myvim-0.0.1.vsix

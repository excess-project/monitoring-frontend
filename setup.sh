#!/bin/bash

#
# GLOBAL VARIABLES
#
BASE_DIR=`pwd`
TMP_DIR=${BASE_DIR}/tmp
DIST_DIR=${BASE_DIR}/dist

#
# SOFTWARE
#
ELASTICSEARCH_VERSION="2.1.1"
ELASTICSEARCH="elasticsearch-${ELASTICSEARCH_VERSION}"
NODE_JS_VERSION="4.2.1"
NODE_JS="node-v${NODE_JS_VERSION}-linux-x64"

#
# SETUP
#
rm -rf ${DIST_DIR}
mkdir ${TMP_DIR}
mkdir ${DIST_DIR}

#
# REQUIRED SOFTWARE CHECKS
# > git
# > wget
#
echo "Checking for required software:"
echo "> git"
command -v git >/dev/null 2>&1 || { echo " git  : Not installed. Aborting." >&2; exit 1; }
echo "> wget"
command -v wget >/dev/null 2>&1 || { echo " wget  : Not installed. Aborting." >&2; exit 1; }
echo "Done."
echo

#
# DOWNLOADING AND INSTALLING EXTERNAL DEPENDENCIES
# > elasticsearch
# > node.js and npm
#
echo "Installing external dependencies:"
echo "> elasticsearch"
cd ${TMP_DIR}
if [ ! -f "${ELASTICSEARCH}.tar.gz" ]
then
    wget https://download.elasticsearch.org/elasticsearch/elasticsearch/${ELASTICSEARCH}.tar.gz
fi
if [ ! -d "${DIST_DIR}/${ELASTICSEARCH}" ]
then
    tar -xf ${ELASTICSEARCH}.tar.gz
    mv ${ELASTICSEARCH} ${DIST_DIR}/elasticsearch
fi

echo "> node.js"
cd ${TMP_DIR}
if [ ! -f "${NODE_JS}.tar.gz" ]
then
    wget https://nodejs.org/dist/v${NODE_JS_VERSION}/${NODE_JS}.tar.gz
fi

if [ ! -d "${DIST_DIR}/${NODE_JS}" ]
then
    tar -xf ${NODE_JS}.tar.gz
    mv ${NODE_JS} ${DIST_DIR}/nodejs
fi
echo "Done."
echo
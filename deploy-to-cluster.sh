#!/bin/bash

echo "Deploying a new development version of the monitoring server to the EXCESS cluster"

VERSION=$1
REPO=$2
#
# set parameters to retrieve artifact from nexus
#
#REPO=snapshots
GROUP=eu/excess-project
ARTIFACT=monitoring-frontend
VERSION=${VERSION}
EXTENSION=tar.gz
#BASE_URL=http://192.168.122.55:8081/nexus/content/repositories
BASE_URL=http://nexus.excess-project.eu/nexus/content/repositories
FILE=${ARTIFACT}-${VERSION}.${EXTENSION}
DOWNLOAD_LOCATION=${BASE_URL}/${REPO}/${GROUP}/${ARTIFACT}/${VERSION}/${FILE}

#
# download artifact to $HOME/jenkins_build
#
mkdir $HOME/jenkins_build
cd $HOME/jenkins_build
wget ${DOWNLOAD_LOCATION}
if [[ ! -f ${FILE} ]]; then
    echo "ERROR: Could not download artifact from repository"
    exit 1;
fi

#
# target
#
if [ ${REPO} = "releases" ]; then
	TARGET_DIR=/opt_local/opt/mf/frontend-stable
else
	TARGET_DIR=/opt_local/opt/mf/frontend-dev
fi

TARGET_FOLDER=${VERSION}
TARGET=${TARGET_DIR}/${TARGET_FOLDER}

echo "  > Installation directory is " ${TARGET}
if [[ -d ${TARGET} ]]; then
    echo "  > Deleting previous directory ..."
    rm -rf ${TARGET}
fi

echo "  > Moving data ..."
mkdir -p ${TARGET}
cd ${TARGET}
tar -xzf $HOME/jenkins_build/${FILE}

#
# cleanup
#
cd $HOME
rm -rf $HOME/jenkins_build

echo "Done."

exit 0;

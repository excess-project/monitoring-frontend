#!/bin/bash

#
# GLOBAL VARIABLES
#
BASE_DIR=`pwd`
TMP_DIR=${BASE_DIR}/tmp
DIST_DIR=${BASE_DIR}/dist

#
# CHECK INSTALLATION
#
echo "Checking ..."
echo "> elasticsearch"
ELASTICSEARCH_BIN=${DIST_DIR}/elasticsearch/bin/elasticsearch
command -v ${ELASTICSEARCH_BIN} >/dev/null 2>&1 || { echo "   : Not installed. Aborting." >&2; exit 1; }

RESULT=$(netstat -lnt | awk '$6 == "LISTEN" && $4 ~ ":9200"')
if [[ -z "${RESULT// }" ]]
then
    nohup ${ELASTICSEARCH_BIN} >/dev/null 2>&1 &
    echo $! > ${TMP_DIR}/elasticsearch.pid
else
    echo "> port 9200 already bound by another process. Aborting."
    exit 1;
fi

sleep 10

HTTP_STATUS=$(curl -s -w %{http_code} localhost:9200)
if [[ ${HTTP_STATUS} != *"200"* ]]
then
    echo "> Elasticsearch is unreachable. Aborting."
    exit 1;
fi
echo "Done. Elasticsearch started successfully on port 9200."
echo

echo "Starting the monitoring server ..."
NODE_BIN=${DIST_DIR}/nodejs/bin/node
NPM_BIN=${DIST_DIR}/nodejs/bin/npm
command -v ${NODE_BIN} >/dev/null 2>&1 || { echo " node  : Not installed. Aborting." >&2; exit 1; }
command -v ${NPM_BIN} >/dev/null 2>&1 || { echo " npm  : Not installed. Aborting." >&2; exit 1; }

${NPM_BIN} install
nohup ./bin/www >/dev/null 2>&1 &
echo $! > ${TMP_DIR}/node.pid

echo "Opening web browser on http://localhost:3000"
command -v python >/dev/null 2>&1 || { echo " python  : Not installed. Aborting." >&2; exit 1; }
python -mwebbrowser http://localhost:3000 &
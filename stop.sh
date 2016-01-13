#!/bin/bash

BASE_DIR=.
TMP_DIR=${BASE_DIR}/tmp

cd ${TMP_DIR}

echo "Stopping services ..."
echo "> elasticsearch"
if [ -f "elasticsearch.pid" ]
then
    PID=$(cat elasticsearch.pid)
    kill ${PID}
    rm -f elasticsearch.pid
else
    echo "Couldn't find PID associated with elasticsearch process."
    echo "Please kill the service manually."
fi

echo "> node"
if [ -f "node.pid" ]
then
    PID=$(cat node.pid)
    kill ${PID}
    rm -f node.pid
else
    echo "Couldn't find PID associated with node process."
    echo "Please kill the service manually."
fi
echo "Done."
echo
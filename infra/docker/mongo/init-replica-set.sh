#!/usr/bin/env bash
set -euo pipefail

echo "Waiting for mongo to accept connections..."
until mongosh --host mongo --port 27017 --eval "db.runCommand({ ping: 1 })" >/dev/null 2>&1; do
  sleep 1
done

STATUS=$(mongosh --host mongo --port 27017 --quiet --eval "try { rs.status().ok } catch(e) { 0 }")

if [ "$STATUS" != "1" ]; then
  echo "Initiating single-node replica set rs0 (transaction support, local/dev/CI only)..."
  mongosh --host mongo --port 27017 --eval '
    rs.initiate({
      _id: "rs0",
      members: [{ _id: 0, host: "localhost:27017" }]
    });
  '
else
  echo "Replica set already initiated."
fi

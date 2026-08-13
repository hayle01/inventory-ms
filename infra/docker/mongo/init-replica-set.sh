#!/usr/bin/env bash
set -euo pipefail

echo "Waiting for mongo to accept connections..."
until mongosh --host mongo --port 27018 --eval "db.runCommand({ ping: 1 })" >/dev/null 2>&1; do
  sleep 1
done

STATUS=$(mongosh --host mongo --port 27018 --quiet --eval "try { rs.status().ok } catch(e) { 0 }")

if [ "$STATUS" != "1" ]; then
  echo "Initiating single-node replica set rs0 (transaction support, local/dev/CI only)..."
  # The advertised member host must be the address host-side clients (API,
  # worker, Compass) actually reach this container on, and its port must
  # equal mongod's own listening port -- mongod self-validates the config
  # against its own bound port on every rs.initiate()/rs.reconfig() call.
  mongosh --host mongo --port 27018 --eval '
    rs.initiate({
      _id: "rs0",
      members: [{ _id: 0, host: "localhost:27018" }]
    });
  '
else
  echo "Replica set already initiated."
fi

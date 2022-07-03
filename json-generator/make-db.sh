#!/bin/sh
set -e

agdq_stats_root="/Users/alligator/code/agdq-stats"

function db_import() {
  echo "importing $1"
  # insert marathon
  duckdb gdq.db "INSERT INTO marathons(id, name) VALUES ($2, '$1')"

  # stats
  echo "ts,viewers,donations" > viewers.csv
  jq -r '.viewers[] | @csv' "$agdq_stats_root/$1.json" >> viewers.csv
  duckdb gdq.db <<EOF
INSERT INTO viewers(ts, viewers, donations, marathon)
SELECT
  to_timestamp(ts::INTEGER) AS ts,
  viewers,
  donations,
  $2 AS marathon
FROM 'viewers.csv'
EOF

  # games
  echo "ts,name" > games.csv
  jq -r '.games[][:2] | @csv' "$agdq_stats_root/$1.json" >> games.csv
  duckdb gdq.db <<EOF
INSERT INTO games(ts, name, marathon)
SELECT
  to_timestamp(ts::INTEGER) as ts,
  name,
  $2 AS marathon
FROM 'games.csv'
EOF

  rm games.csv
  rm viewers.csv
}

if [ -e gdq.db ]; then
  rm gdq.db
fi

duckdb gdq.db <<EOF
CREATE TABLE viewers(
  ts        TIMESTAMP,
  marathon  INTEGER,
  viewers   INTEGER,
  donations INTEGER
);

CREATE TABLE games(
  ts        TIMESTAMP,
  marathon  INTEGER,
  name      VARCHAR,
  runners   VARCHAR,
  category  VARCHAR
);

CREATE TABLE marathons(
  id    INTEGER PRIMARY KEY,
  name  VARCHAR
);
EOF

# db_import agdq14 0
# db_import sgdq14 1
# db_import agdq15 2
# db_import sgdq15 3
# db_import agdq16 4
# db_import sgdq16 5
db_import agdq17 0
db_import sgdq17 1
db_import agdq18 2
db_import sgdq18 3
db_import agdq19 4
db_import sgdq19 5
db_import agdq20 6
db_import sgdq20 7
db_import agdq21 8
db_import sgdq21 9
db_import agdq22 10
db_import sgdq22 11

# json generator

generates JSON for the comparison, by creating a duckdb database and running queries against it.

run `make-db.sh` to create the database, then `python3 generate-json.py` to generate a JSON file.

to be done: update the database in place, so this can be run every 5 mins when a marathon is in progress.

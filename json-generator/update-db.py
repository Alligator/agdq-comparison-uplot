import duckdb
import sys
import os
import json
import csv

if len(sys.argv) < 2:
    print('no marathon name given!')
    exit(1)

con = duckdb.connect('gdq.db', read_only=False)

# check marathon exists
marathon_name = sys.argv[1]
con.execute('SELECT * FROM marathons WHERE name = ?', [marathon_name])
marathon = con.fetchone()
if marathon is None:
    print(f'no marathon named {marathon_name} found')
    exit(1)

# generate csv files
stats_file = os.path.join('/Users/alligator/code/agdq-stats', f'{marathon_name}.json')
j = json.load(open(stats_file))

with open('viewers.csv', 'w') as csvfile:
    w = csv.writer(csvfile)
    w.writerow(['ts', 'viewers' ,'donations'])
    w.writerows(j['viewers'])

with open('games.csv', 'w') as csvfile:
    w = csv.writer(csvfile)
    w.writerow(['ts', 'name'])
    for g in j['games']:
        w.writerow(g[:2])

# clear old data
marathon_id = marathon[0]
con.execute('DELETE FROM games WHERE marathon = ?', [marathon_id])

# import new data
con.execute('''
INSERT INTO viewers(ts, viewers, donations, marathon)
SELECT
  to_timestamp(ts::INTEGER) AS ts,
  viewers,
  donations,
  ? AS marathon
FROM 'viewers.csv'
''', [marathon_id])

con.execute('''
INSERT INTO games(ts, name, marathon)
SELECT
  to_timestamp(ts::INTEGER) as ts,
  name,
  ? AS marathon
FROM 'games.csv'
''', [marathon_id])

os.remove('viewers.csv')
os.remove('games.csv')

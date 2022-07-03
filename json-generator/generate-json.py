import duckdb
import json
import sys
from pprint import pprint

con = duckdb.connect('gdq.db', read_only=True)

con.execute('SELECT name FROM marathons')
marathons = con.fetchall()

con.execute('''
    WITH marathon_start AS (
        -- find the start time and 3pm on the start day of each marathon
        SELECT
            min(g.ts) AS start,
            date_trunc('day', min(g.ts)) + INTERVAL 15 HOUR AS threepm,
            m.id
        FROM marathons AS m
        JOIN games AS g ON g.marathon = m.id
        GROUP BY m.id
    ),
    root_ts AS (
        -- find the earliest 3pm and use that as our root timestamp
        SELECT min(threepm) AS ts FROM marathon_start
    ),
    marathon_diffs AS (
        -- figure out how much each marathon's times need to be offset
        -- to make them line up with the root timestamp
        SELECT
            m.id,
            m.name,
            ms.threepm - root.ts AS diff,
            root.ts
        FROM marathons AS m
        JOIN marathon_start AS ms ON ms.id = m.id
        CROSS JOIN root_ts AS root
    ),
    fivemin_viewers AS (
        -- offset the times and truncate them to 5 minute accuracy
        SELECT
            to_timestamp((epoch(v.ts - md.diff) / 60 / 5) * 60 * 5) AS fivemints,
            v.viewers,
            v.donations,
            v.marathon
        FROM viewers AS v
        JOIN marathon_diffs AS md ON md.id = v.marathon
        WHERE v.ts - md.diff > md.ts
    )
    -- finally, get the max viewers and donations for each 5 minute bucket
    -- for each marathon
    SELECT
        epoch(fivemints) AS ts,
        marathon,
        max(viewers) as viewers,
        max(donations) as donations
    FROM fivemin_viewers AS fv
    GROUP BY fivemints, marathon
    ORDER BY fivemints
''')

f_ts = 0
f_marathon = 1
f_viewers = 2
f_donations = 3

ts_series = []
viewers_series = [[] for i in range(len(marathons))]
donations_series = [[] for i in range(len(marathons))]

ts = None
while True:
    row = con.fetchone()
    if row == None:
        break
    if ts != row[f_ts]:
        ts = row[f_ts]
        ts_series.append(ts)
    viewers_series[row[f_marathon]].append(row[f_viewers])
    donations_series[row[f_marathon]].append(row[f_donations])

con.execute('''
    WITH max_viewers AS (
        SELECT *
        FROM (
            SELECT
                *,
                row_number() OVER (PARTITION BY marathon ORDER BY v.viewers DESC)
            FROM viewers AS v
            WHERE v.viewers IS NOT NULL
        )
        WHERE row_number = 1
    ),
    games_reverse AS (
        SELECT *
        FROM games
        ORDER BY ts DESC
    )
    SELECT
        m.name,
        m.id,
        max(v.donations) AS max_donations,
        max(mv.viewers) AS max_viewers,
        epoch(max(mv.ts)) as max_viewers_ts,
        (
            SELECT name
            FROM games_reverse AS g
            WHERE g.marathon = m.id
            AND g.ts < max(mv.ts)
            LIMIT 1
        ) AS max_viewers_game
    FROM viewers AS v
    JOIN max_viewers AS mv ON mv.marathon = v.marathon
    JOIN marathons AS m ON m.id = v.marathon
    GROUP BY m.name, m.id
    ORDER BY m.id DESC
''')

other_stats = []
desc = [d[0] for d in con.description]
for row in con.fetchall():
    r = dict(zip(desc, row))
    other_stats.append(r)

output = {
    'ts': ts_series,
    'viewers': viewers_series,
    'donations': donations_series,
    'marathons': [m[0] for m in marathons],
    'other_stats': other_stats,
}
json.dump(output, open('out.json', 'w'))

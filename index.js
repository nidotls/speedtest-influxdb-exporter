require('dotenv').config()
const ping = require('ping');
const speedTest = require('speedtest-net');
const CronJob = require('cron').CronJob;
const { InfluxDB, Point, HttpError } = require('@influxdata/influxdb-client');

const hosts = [
    '1.1.1.1',
    '8.8.8.8',
]
let speedtestIndex = 0;

const writeApi = new InfluxDB({
    url: process.env.INFLUXDB_URL,
    token: process.env.INFLUXDB_TOKEN
}).getWriteApi(process.env.INFLUXDB_ORG, process.env.INFLUXDB_BUCKET, 'ns');

new CronJob(
    '0 */10 * * * *',
    function () {
        startSpeedTest();
    },
    null,
    true,
    'Europe/Berlin'
);

new CronJob(
    '* * * * * *',
    async function () {
        for (let host in hosts) {
            host = hosts[host];

            try {
                let res = await ping.promise.probe(host);

                const point = new Point('ping')
                    .tag('host', host)
                    .intField('ping', res.time)
                    .timestamp(new Date());

                writeApi.writePoint(point);
            } catch (e) {
            }
        }
    },
    null,
    true,
    'Europe/Berlin'
);

async function startSpeedTest() {
    let runNumber = ++speedtestIndex;
    console.time(`speedtest#${runNumber}`);
    try {
        const result = await speedTest({
            acceptLicense: true,
            acceptGdpr: true
        });

        writeApi.writePoint(new Point('speedtest')
            .tag('server_host', result.server.host)
            .tag('server_name', result.server.name)
            .tag('isp', result.isp)
            .tag('interface_external_ip', result.interface.externalIp)
            .booleanField('up', true)
            .stringField('isp', result.isp)
            .stringField('interface_external_ip', result.interface.externalIp)
            .floatField('ping_jitter', result.ping.jitter)
            .floatField('ping_latency', result.ping.latency)
            .intField('download_bandwidth', result.download.bandwidth)
            .intField('download_bytes', result.download.bytes)
            .intField('download_elapsed', result.download.elapsed)
            .intField('upload_bandwidth', result.upload.bandwidth)
            .intField('upload_bytes', result.upload.bytes)
            .intField('upload_elapsed', result.upload.elapsed)
            .floatField('packet_loss', result.packetLoss)
            .timestamp(result.timestamp));
    } catch (err) {
        writeApi.writePoint(new Point('speedtest')
            .booleanField('up', false));

        console.log('Speedtest errored', err.message);
    } finally {
        console.timeEnd(`speedtest#${runNumber}`);
    }
}

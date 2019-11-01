const fs = require('fs-extra');
const path = require('path');
const {curly} = require('node-libcurl');
const moment = require('moment');
const yaml = require('js-yaml');
const servers = yaml.safeLoad(fs.readFileSync('./servers.yml', 'utf8'));

const writeFile = async (path, content) => {
	try {
		await fs.outputFile(path, content);
		console.log('Summary created');
	} catch (e) {
		console.log('Summary created failed!');
	}
};

const summaryFilePath = path.resolve(`./summaries/summary-${moment().format('YYYY-MM-DD')}.txt`);

const formatReport = (reportStack, serverGroupName, dataVolume) => {
	//shortest first
	reportStack.length && reportStack.sort((a, b) => a.usedTime - b.usedTime);
	return `
	--- [${serverGroupName}] Finished curling for ${reportStack.length} servers in ${dataVolume} ---
	The fastest one is *** ${reportStack[0] && reportStack[0].location} ***, ${reportStack[0] && reportStack[0].usedTime} seconds taken!
	---
	
	Details:
	
	${reportStack.map(result => `
		*** ${result.location}
		url: ${result.url}
		error: ${result.error}
		speed(Avg): ${(parseInt(result.dataVolume) / result.usedTime).toFixed(2)}M/s
		Data curled: ${result.dataVolume}
		Time spent: ${result.usedTime}
		***
		
	`).join(' ')}
		 
	`;
};

const curlServer = async (server, dataVolume) => {
	let usedTime = 0;
	try {
		const startTime = moment();
		console.log(`Start curling location [${server.location}]`, server[dataVolume]);
		const { statusCode } = await curly.get(server[dataVolume]);
		const endTime = moment();
		usedTime = endTime.diff(startTime, 'seconds');

		console.log(`Done in ${usedTime} seconds`);

		return {
			location: server.location,
			url: server[dataVolume],
			error: null,
			dataVolume,
			statusCode,
			usedTime,
		};
	} catch (e) {
		return {
			location: server.location,
			url: server[dataVolume],
			error: e,
			dataVolume,
			statusCode: 'Error',
			usedTime,
		};
	}
};

const report = async dataVolume => {
	const serverGroup = Object.keys(servers);
	await serverGroup.map(async serverName => {
		try {
			const reportStack = [];
			for (let i=0; i < servers[serverName].length; i++) {
				reportStack.push(await curlServer(servers[serverName][i], dataVolume));
			}
			await writeFile(summaryFilePath, formatReport(reportStack, serverName, dataVolume));
			console.log('Finished reporting!')
		} catch (e) {
			console.log(e);
		}
	});
};

report('100m').catch(e => console.log(e));

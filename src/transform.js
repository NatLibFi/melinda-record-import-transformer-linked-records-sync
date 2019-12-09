/**
*
* @licstart  The following is the entire license notice for the JavaScript code in this file.
*
* Record link migration transformer for the Melinda record batch import system
*
* Copyright (C) 2018 University Of Helsinki (The National Library Of Finland)
*
* This file is part of melinda-record-import-transformer-record-link-migration
*
* melinda-record-import-transformer-record-link-migration program is free software: you can redistribute it and/or modify
* it under the terms of the GNU Affero General Public License as
* published by the Free Software Foundation, either version 3 of the
* License, or (at your option) any later version.
*
* melinda-record-import-transformer-record-link-migration is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU Affero General Public License for more details.
*
* You should have received a copy of the GNU Affero General Public License
* along with this program.  If not, see <http://www.gnu.org/licenses/>.
*
* @licend  The above is the entire license notice
* for the JavaScript code in this file.
*
*/

import {chain} from 'stream-chain';
import {parser} from 'stream-json';
import {streamArray} from 'stream-json/streamers/StreamArray';
import {MarcRecord} from '@natlibfi/marc-record';
import validator from './validate';
import moment from 'moment';
import {EventEmitter} from 'events';
import {Utils} from '@natlibfi/melinda-commons';

const {createLogger} = Utils;
const logger = createLogger();

class TransformEmitter extends EventEmitter {}

export default function (stream, {validate = true, fix = true}) {
	MarcRecord.setValidationOptions({subfieldValues: false});
	const Emitter = new TransformEmitter();

	readStream(stream);
	return Emitter;

	async function readStream(stream) {
		let promises = [];

		try {
			const pipeline = chain([
				stream,
				parser(),
				streamArray()
			]);

			pipeline.on('data', async data => {
				promises.push(transform(data.value));
				async function transform(value) {
					const result = await convertRecord(value);
					Emitter.emit('record', result);
				}
			});
			pipeline.on('end', async () => {
				console.log(`: Handled ${promises.length} recordEvents`);
				await Promise.all(promises);
				Emitter.emit('end', promises.length);
			});
		} catch (err) {
			Emitter.emit('error', err);
		}
	}

	// If inputData is boolean false output record is failed record
	async function convertRecord(inputData) {
		// InputData : { record: record, linkData: [{400: data}, {100: data}, {135: data}]}
		// TODO: place data from link data to record, validate and send to import queue

		logger.log('debug', inputData.record);

		const creationDate = moment().format('YYMMDD');
		let record = new MarcRecord({
			leader: '00000ngm a22005774i 4500',
			fields: [
				{
					tag: '008',
					value: `${creationDate}    fi ||| g^    |    v|mul|c`
				},
				{
					tag: '024',
					subfields: [{code: 'a', value: '000000'}]
				},
				{
					tag: '245',
					subfields: [{code: 'a', value: 'foobar'}]
				}
			]
		});

		if (inputData === false) {
			record.appendField({tag: 'FOO', value: 'bar'});
		}

		if (validate === true || fix === true) {
			// Validation works only if inputData is type boolean: true or false.
			return validator(record, validate, fix);
		}

		// No validation or fix = all succes!
		return {failed: false, record: {...record}};
	}
}

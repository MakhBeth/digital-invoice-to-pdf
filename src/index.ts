import * as xml2jsSource from "xml2js";
import { stripPrefix, parseNumbers } from "xml2js/lib/processors";
import ReactPDF from "@react-pdf/renderer";
import { promisify } from "util";
import GeneratePDF from "./renderer";
import dataExtractor from "./dataExtractor";
import type { InvoiceJSON } from "./types/DigitalInvoiceJson";
import type { Options } from "./types/Options";

const xml2jsPromise = promisify<
	xml2jsSource.convertableToString,
	xml2jsSource.OptionsV2,
	InvoiceJSON
>(xml2jsSource.parseString);

const defaultOptions: Options = {
	locale: "it",
	footer: true,
	colors: {},
};

const xmlToJson = async (xml: string, options: Options = defaultOptions) => {
	try {
		const parsedJson = await xml2jsPromise(xml, {
			async: true,
			trim: true,
			explicitArray: false,
			attrkey: "attributes",
			tagNameProcessors: [stripPrefix],
			attrNameProcessors: [stripPrefix],
			valueProcessors: [parseNumbers],
		});
		return parsedJson;
	} catch (error) {
		return Promise.reject(new Error(error?.toString()));
	}
};

const xmlToCompactJson = async (
	xml: string,
	options: Options = defaultOptions,
) => {
	try {
		const parsedJson = await xmlToJson(xml, options);
		return dataExtractor(parsedJson);
	} catch (error) {
		return Promise.reject(new Error(error?.toString()));
	}
};

const xmlToPDF = async (xml: string, options = defaultOptions) => {
	try {
		const parsedJson = await xmlToCompactJson(xml, options);
		return ReactPDF.renderToStream(GeneratePDF(parsedJson, options));
	} catch (error) {
		return Promise.reject(new Error(error?.toString()));
	}
};

export { xmlToJson, xmlToCompactJson, xmlToPDF };

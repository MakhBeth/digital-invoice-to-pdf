import Fastify from "fastify";
import * as xml2jsSource from "xml2js";
import { stripPrefix, parseNumbers } from "xml2js/lib/processors";
import ReactPDF from "@react-pdf/renderer";
import { promisify } from "util";
import GeneratePDF from "./renderer";
import dataExtractor from "./dataExtractor";
import type { InvoiceJSON } from "./types/DigitalInvoiceJson";
import type { Options } from "./types/Options";
import fastifyMultipart from "@fastify/multipart";

const fastify = Fastify({
	logger: true,
});

// Register multipart support
fastify.register(fastifyMultipart);

const xml2jsPromise = promisify<
	xml2jsSource.convertableToString,
	xml2jsSource.OptionsV2,
	InvoiceJSON
>(xml2jsSource.parseString);

const defaultOptions: Options = {
	locale: "it-IT",
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

// Convert XML file to PDF endpoint
fastify.post("/convert", async (request, reply) => {
	try {
		const data = await request.file();
		if (!data) {
			reply.code(400);
			throw new Error("No file uploaded");
		}

		const xmlContent = await data.toBuffer();
		const pdfStream = await xmlToPDF(xmlContent.toString(), defaultOptions);

		reply
			.header("Content-Type", "application/pdf")
			.header("Content-Disposition", "attachment; filename=invoice.pdf");

		return pdfStream;
	} catch (error: any) {
		throw new Error(`Failed to convert XML to PDF: ${error.message}`);
	}
});

// Health check endpoint
fastify.get("/health", async () => {
	return { status: "ok" };
});

// Start the server
const start = async () => {
	try {
		await fastify.listen({
			port: 3000,
			host: "0.0.0.0",
			listenTextResolver: () => `Server listening at http://localhost:3000`, // Optional but recommended
		});
	} catch (err) {
		fastify.log.error(err);
		process.exit(1);
	}
};

start();

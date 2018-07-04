"use strict";

const fs = require("fs");
const Path = require("path");
const Hapi = require("hapi");
const Inert = require("inert");
const parse = require("csv-parse");

const csvFile = "../Master.csv";

const COLUMNS = [
  "clid",
  "src",
  "dst",
  "dcontext",
  "channel",
  "dstchannel",
  "lastapp,",
  "lastdata",
  "start",
  "answer",
  "end",
  "duration",
  "bills",
  "disposition",
  "amaflags",
  "accountcode",
  "uniqueid",
  "user field",
  "sequence"
];

// GLOBAL FILE DATA
let csvData = [];

const loadData = () =>
  new Promise(function(resolve, reject) {
    console.log("Data Refreshing");
    csvData = [];
    fs.createReadStream(csvFile)
      .pipe(parse({ delimiter: "," }))
      .on("data", csvrow => {
        csvData.push(csvrow);
      })
      .on("end", () => {
        console.log("Data Loaded");
        resolve();
      });
  });

// Create a server with a host and port
const server = Hapi.server({
  host: "localhost",
  port: 8000,
  routes: {
    files: {
      relativeTo: Path.join(__dirname, "public")
    }
  }
});

const io = require("socket.io")(server.listener);

io.on("connection", () => {
  console.log("socket connected");
});

// REFRESH THE FILE WHEN CHANGED
fs.watchFile(csvFile, async () => {
  await loadData();
  io.emit("file-update", { for: "everyone" });
});

/**
 *
 * @param {FILE} Sheet
 * [
 *    {"A": {}, B: {}},
 *    {"A": {}, B: {}}
 * ]
 */
const parseExcelFile = data =>
  data
    .map(row => {
      let obj = {};
      COLUMNS.forEach((title, index) => {
        obj[title] = row[index];
      });
      return obj;
    })
    .reverse()
    .slice(0, 200);

// Add the route
server.route({
  method: "GET",
  path: "/",
  handler: function(request, h) {
    const allCalls = parseExcelFile(csvData);
    const unansweredCalls = allCalls.filter(
      ({ disposition }) => disposition !== "ANSWERED"
    );

    const stats = {
      total: allCalls.length,
      answered: allCalls.length - unansweredCalls.length,
      unanswered: unansweredCalls.length
    };

    return h.view("index", {
      stats,
      allCalls,
      unansweredCalls
    });
  }
});

// Start the server
async function start() {
  try {
    await loadData();
    await server.register(require("vision"));
    await server.register(Inert);

    server.route({
      method: "GET",
      path: "/assets/{param*}",
      handler: {
        directory: {
          path: ".",
          redirectToSlash: true,
          index: true
        }
      }
    });

    server.views({
      engines: {
        html: require("handlebars")
      },
      relativeTo: __dirname,
      path: "templates"
    });
    await server.start();
  } catch (err) {
    console.log(err);
    process.exit(1);
  }

  console.log("Server running at:", server.info.uri);
}
start();

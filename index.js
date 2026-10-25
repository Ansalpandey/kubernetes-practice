const express = require("express");
const { version } = require("./package.json");

const app = express();
const port = 3000;

app.get("/", (req, res) => {
  res.send(
    `Hello World!, Server is running using jenkins file. Version: ${version}`,
  );
});

app.listen(port, () => {
  console.log(
    `Server is running on http://localhost:${port} (Version: ${version})`,
  );
});

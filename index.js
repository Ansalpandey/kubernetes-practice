const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('Hello World!, Server is running using jenkins');
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
const express = require("express");
const http = require("http");
const upload = require("express-fileupload");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const dbPath = path.join(__dirname, "entriesData.db");

const app = express();

app.use(express.json());
app.use(cors());
app.use(upload());

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(process.env.PORT || 3001, () => {
      console.log("server is running at https://localhost:3001/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

authenticateToken = (req, res, next) => {
  let jwtToken;
  const authHeader = req.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (authHeader === undefined) {
    res.status(401);
    res.json({ message: "authorization failure" });
  } else {
    next();
  }
};

app.post("/register/", async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const getUserQuery = `SELECT * FROM members WHERE username LIKE '${username}';`;
  const dbUser = await db.get(getUserQuery);
  if (dbUser !== undefined) {
    res.status(400);
    res.json({
      message:
        "This Member Is Already Registered...Try With Different Username Or Login With This Username...",
    });
  } else {
    const dbAddMemberQuery = `
    INSERT INTO members(username, password) 
    VALUES ('${username}', '${hashedPassword}');`;
    await db.run(dbAddMemberQuery);
    res.status(200);
    res.json({
      message: "Your Registration Is Completed. Please Login Now...",
    });
  }
});

app.post("/login/", async (req, res) => {
  const { username, password } = req.body;
  const dbMemberQuery = `SELECT * FROM members WHERE username LIKE '${username}';`;
  const dbMember = await db.get(dbMemberQuery);

  if (dbMember === undefined) {
    res.status(400);
    res.json({ message: "Invalid Username..." });
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbMember.password);
    if (isPasswordMatched) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "secretToken");
      res.send({ jwtToken });
    } else {
      res.status(400);
      res.json({ message: "Incorrect Password..." });
    }
  }
});

app.post("/uploadFile/", authenticateToken, async (req, res) => {
  const data = req.body;
  const emptyTheEntriesDataQuery = `DELETE FROM entries_data;`;
  await db.run(emptyTheEntriesDataQuery);
  if (data.length === undefined) {
    res.status(400).json({ msg: "invalid file" });
  } else {
    data.map(async (eachItem) => {
      const addDataQuery = `INSERT INTO entries_data(id, userId, title, body) VALUES('${eachItem.id}', '${eachItem.userId}', '${eachItem.title}', '${eachItem.body}')`;
      await db.run(addDataQuery);
    });
    res
      .status(200)
      .json({ msg: "data of the file is uploaded into database..." });
  }
});

app.get("/getEntriesData/", authenticateToken, async (req, res) => {
  const entriesDataQuery = `SELECT * FROM entries_data;`;
  const entriesData = await db.all(entriesDataQuery);
  const stringifiedData = JSON.stringify(entriesData);
  res.status(200);
  res.json({ entriesData: stringifiedData });
});

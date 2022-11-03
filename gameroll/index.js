const express = require('express');
const app = express();
const pgp = require('pg-promise')();
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const axios = require('axios');
const { render } = require('ejs');


// database configuration
const dbConfig = {
    host: 'db',
    port: 5432,
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  };
  
  const db = pgp(dbConfig);
  
  // test your database
  db.connect()
    .then(obj => {
      console.log('Database connection successful'); // you can view this message in the docker compose logs
      obj.done(); // success, release the connection;
    })
    .catch(error => {
      console.log('ERROR:', error.message || error);
    });


// 3. App settings
app.set('view engine', 'ejs');

app.use(bodyParser.json());

app.use(
    session({
      secret: process.env.SESSION_SECRET,
      saveUninitialized: false,
      resave: false,
    })
  );
  
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

// 4. Get /
app.get('/', (req, res) =>{
  res.redirect('pages/home'); //this will call the /anotherRoute route in the API
});

app.get('/register', (req, res) => {
  res.render('pages/register');
});

// 6. POST /register
// Register submission
app.post('/register', async (req, res) => {
    console.log("post register");
    const name = req.body.username;
    const hash = await bcrypt.hash(req.body.password, 10);
    const query = "INSERT INTO users(username, password) VALUES ($1, $2);";
    db.any(query, [
      req.body.username,
      hash,
    ])
    .then(function (rows) {
        res.redirect('/login');
      })
    .catch(function (err) {
        res.redirect('/register');
    });
  });

// 7. GET /login
  app.get('/login', (req, res) => {
    res.render('pages/login');
  });

// 8. POST /login
// Login submission
app.post('/login', async(req, res) => {
  console.log("post login");
    // const username = req.body.username;
    // const password = req.body.password;
    // const query = "SELECT password from users where username = $1";
    // let user = await db.oneOrNone(query, [
    //   req.body.username,
    // ]);
    // if(user) // if the user exists
    // {
    //   const match = await bcrypt.compare(req.body.password, user.password); //await is explained in #8
    //   if(match) //but the password is right
    //   {
    //     req.session.user = { api_key: process.env.API_KEY};
    //     req.session.save();
    //     res.redirect('/discover');
    //   }
    //   else // the password is wrong
    //   {
    //     console.log("Incorrect username or password.");
    //     res.redirect('/login');
    //   }
    // }
    // else //if the user is not found
    // {
    //   console.log("User not found.");
    //   res.redirect('/register');
    // }
});



app.post('/register', async (req, res) => {

  // hash to be used/tested later
  // const hash = await bcrypt.hash(req.body.password, 10);

  const query = `INSERT INTO users (email, password) VALUES ($1, $2);`;

  db.any(query, [
    req.body.email,
    req.body.passsword // change to 'hash' later when hashing passwords is implemented
  ])
});
  
// 9. Authentication middleware

const auth = (req, res, next) => {
  if (!req.session.user) {
    // Default to register page.
    return res.redirect('/register');
  }
  next();
};

  // Authentication Required
  app.use(auth);

// 10. GET /discover
app.get('/profile',(req, res) => {
    res.redirect("pages/profile");
  });

  // 11. GET /logout
  app.get('/logout', (req, res) => {
    req.session.destroy();
    res.render('pages/logout');
  });




app.listen(3000);
console.log("Server is listening on port 3000");
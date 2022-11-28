const express = require('express');
const app = express();
const pgp = require('pg-promise')();
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const axios = require('axios');
const { render } = require('ejs');
const { response } = require('express');
const { queryResult } = require('pg-promise');

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

app.use(express.static("resources"));   //Links css stylesheet

// Get empty route to redirect to /home
app.get('/', (req, res) =>{
  res.redirect('/home');
});

async function getRandomId(){
  var query = "fields name, url, screenshots.*, release_dates.*, genres.*, platforms.*, summary ; where (summary != null & screenshots != null);";
  var randomGameId = 0;   //Creates a new blank array of 5 objects to store random game positions

  await axios({   //We should move this call out of /home so that it is only called once when starting
    url: `https://api.igdb.com/v4/games/count`,
        method: 'POST',
        dataType:'text',
        headers: {
          "Client-ID": process.env.client_id,
          "Authorization": process.env.authorization,
        },
        data: query,  //Base query to return the number of games that match our criteria
    })
    .then( results => {
    
      console.log("---Game Count Determined: " + results.data.count + "---"); // the results will be displayed on the terminal if the docker containers are running
      count = results.data.count;
      //return count;
    })
    .catch(error => {
    // Handle errors
      console.log("Error with initial API count call.")
  });

  randomGameId = Math.floor(Math.random() * (count -1));

  return randomGameId;
}

app.get('/home',async (req, res) => {
  console.log("\n---NEW /home call---\n");
  const game_id = req.query.game_id ?? await getRandomId();
  var query = "fields name, url, screenshots.*, release_dates.*, genres.*, platforms.*, summary ; where (summary != null & screenshots != null);";
  
  axios({
      url: `https://api.igdb.com/v4/games`,
          method: 'POST',
          dataType:'text',
          headers: {
              "Client-ID": process.env.client_id,
              "Authorization": process.env.authorization,
          },
          data: `${query} offset  ${game_id} ; limit 2;`, 
      })
      .then(results => {
          console.log(results.data); // the results will be displayed on the terminal if the docker containers are running
          res.render('pages/home', {    //Parameters being sent
            results: results,
            message: req.query.message
      });
      })
      .catch(error => {
      // Handle errors
        res.render('pages/home', {
          results: [],
          message: error.message || error
        });
    });
});

app.get('/register', (req, res) => {
  res.render('pages/register');
});

// Register submission
app.post('/register', async (req, res) => {
    console.log("post register");
    // const test = await db.query("SELECT * FROM users;")
    // console.log(test)
    // const name = req.body.username;
    const hash = await bcrypt.hash(req.body.password, 10);
    const query = "INSERT INTO users(email, password) VALUES ($1, $2);";
    db.any(query, [
      req.body.email,
      hash
    ])
    .then(function (data) {
        res.redirect('/login');
    })
    .catch(function (err) {
        res.render('pages/register',{message:"Error"});
    })
  });

// login route
app.get('/login', (req, res) => {
  res.render('pages/login');
});

// Login submission
app.post('/login', async(req, res) => {
  console.log("post login");
    const email = req.body.email;
    const password = req.body.password;
    const query = `SELECT * FROM users WHERE email = $1;`;
    
    db.one(query, [
      email,
      password
    ])
    .then(async (user)=> {
      const match = await bcrypt.compare(req.body.password, user.password)
      if(match){
        req.session.user = {
          user_id: process.env.USER_ID,
        };
        req.session.save();
        res.redirect('/home');
      }else{
        res.redirect('/login');
        res.render('pages/login', {message : 'Need to sign in to access this page'});
      }
    })
    .catch(function(err){
      res.redirect('/register');
      return console.log(err);
    });
});



// Authentication middleware
const auth = (req, res, next) => {
  if (!req.session.user) {
    // Default to register page.
    //Creates message when user is not signed in
    return res.redirect(`/home?message=${'You need to register or log in to use this feature!'}`);
  }
  next();
};

app.get('/nextGame', async (req,res) => {
  const randomGameId = req.query.game_id ?? await getRandomId();
  //var rand = Math.round( * Math.random());

  axios({
    url: `https://api.igdb.com/v4/games`,
        method: 'POST',
        dataType:'text',
        headers: {
          "Client-ID": process.env.client_id,
          "Authorization": process.env.authorization,
        },
        data: "fields *, screenshots.*; limit 3;",
    })
    then(results => {
      res.render('pages/randomHome', {results: results.data[rand]})
    })
    .catch(error => {   // Handle errors
      res.render('pages/home', {
        results: [],
        message: error.message || error
      });
  });
});



// // Authentication Required
app.use(auth);

  app.get('/profile', (req, res) => {
   db.any('SELECT * from games')
    .then(games => {
        console.log(games);
        //test data- can be removed when database is fully implemented
        games = [
          {
            name: 'Hi',
            game_id: 1,
          }
        ]
      res.render('pages/profile', {games})
    })
    .catch(err => {
        res.render('pages/profile',{
          games: [],
          message: err.message || err
        });
        
    });
});

app.post('/saveGame', (req,res) => {
  const query = `INSERT INTO user_to_games(user_id, game_name) VALUES ($1,$2);`;

  db.one(query, [
    req.session.user.user_id,
    req.body.game_name
  ])
  .then(data => {
    res.redirect('/home');
    console.log("Game name added to data base");
  })
  .catch(err => {
    res.redirect('/home');
    console.log(err);
  })
  
});

// logout route
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.render('pages/logout');
});

app.listen(3000);
console.log("Server is listening on port 3000");
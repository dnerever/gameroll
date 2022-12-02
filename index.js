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

const user = {
  email: undefined,
};
  
// test your database
db.connect()
  .then(obj => {
    console.log('Database connection successful'); // you can view this message in the docker compose logs
    obj.done(); // success, release the connection;
  })
  .catch(error => {
    console.log('ERROR:', error.message || error);
  });

// App settings
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

app.use(express.static(__dirname));   //Links css stylesheet

// Get empty route to redirect to /home
app.get('/', (req, res) =>{
  res.redirect('/home');
});

async function getRandomId(){
  var query = "fields name, url, screenshots.*, release_dates.*, genres.*, platforms.*, summary ; where (summary != null & screenshots != null);";
  var randomGameId = 0;   //Creates a new blank array of 5 objects to store random game positions
  var count = 0;
  
  await axios({   
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
      return count;
    })
    .catch(error => {
    // Handle errors
      console.log("Error with initial API count call.")
      return 0;
  });

  randomGameId = Math.floor(Math.random() * (count -1));
  
  return randomGameId;
}

app.get('/home',async (req, res) => {
  //console.log("---/home call---\n");
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
          data: `${query} offset  ${game_id} ; limit 1;`, 
      })
      .then(results => {
          console.log(results.data); // the results will be displayed on the terminal if the docker containers are running
          res.render('pages/home', {    //Parameters being sent
            results: results,
            message: req.query.message,
            loggedin: req.session.loggedin
      });
      })
      .catch(error => {
      // Handle errors
        res.render('pages/home', {
          loggedin: req.session.loggedin,
          results: [],
          message: error.message || error
        });
    });
});

app.get('/register', (req, res) => {
  res.render('pages/register', {loggedin: req.session.loggedin});
});

// Register submission
app.post('/register', async (req, res) => {
  console.log("register-post:");
  // const test = await db.query("SELECT * FROM users;")
  // console.log(test)
  // const name = req.body.username;
  const hash = await bcrypt.hash(req.body.password, 10);
  const searchQuery = `SELECT * FROM users WHERE email = $1;`;
  const insertQuery = "INSERT INTO users(email, password) VALUES ($1, $2);";
  
  db.any(searchQuery, [
    req.body.email
  ])
  .then(function (data) {
    //console.log("Rows: " + data.length);
    if(data.length != 0){
      //console.log("Email already in db")
      res.render('pages/register', {
        message:"Already have an account, please login",
        loggedin: req.session.loggedin
      });
    }
    else{
      db.any(insertQuery, [
        req.body.email,
        hash
      ])
      .then(function (data) {
        res.redirect('/login');
      })
      .catch(function (err) {
        res.render('pages/register', {
          message:"Error saving user",
          loggedin: req.session.loggedin
        });
      })
    }
  })
  .catch(function (err) {
    console.log(".catch err for rows");
    res.render('pages/register', {
      message:"Error checking if account was already present",
      loggedin: req.session.loggedin
    });
  })
});

// login route
app.get('/login', (req, res) => {
  res.render('pages/login', {loggedin: req.session.loggedin});
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
  .then(async (data) => {
    const passwordMatch = await bcrypt.compare(req.body.password, data.password)

    user.email = data.email;
    user.user_id = data.user_id;

    req.session.user = user;

    if(passwordMatch){  //checks that password is correct

      // req.session.user = {
      //   user_id: process.env.USER_ID
      // };
      
      req.session.loggedin = true;
      req.session.save();
      
      res.redirect('/home');
    }else{
      res.render('pages/login', {
        loggedin: req.session.loggedin,
        message:"Password is incorrect, please try again"
      });
    }
  })
  .catch(function(err){
    console.log("!!  Login Error  !!");
    console.log(err);
    return res.render('pages/login', {
      loggedin: req.session.loggedin,
      message:"Email is not recognized, please try again"
    });
  });
});

app.use(function (req, res, next) {
  res.locals.loggedin = req.session.loggedin;
  next();
});
  
// 9. Authentication middleware

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
        data: "fields *, screenshots.*; limit 1;",
    })
    then(results => {
      res.render('pages/home', {results: results.data})
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
   
    const query = `SELECT * FROM games 
    INNER JOIN users_to_games on games.game_id = users_to_games.game_id
    WHERE users_to_games.user_id = $1;`;

    db.any(query, [
      req.session.user.user_id
    ])
    .then(games => {
      console.log(games);
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
  console.log("req.body.game_name: " + req.body.game_name);
  db.tx(async (t) => {
    await t.none(
      `INSERT INTO games(game_id, genre, game_name, screenshots, url) VALUES ($1, $2, $3, $4, $5);`, 
      [req.body.game_id, req.body.genre, req.body.game_name, req.body.game_screenshots, req.body.url]
    );

    await t.none(
      `INSERT INTO users_to_games(user_id, game_id) VALUES ($1,$2);`,
      [req.session.user.user_id, req.body.game_id]
    );
  })
  .then(d => {
    console.log("Game name added to database");
    console.log("User id: ");
    console.log(req.session.user.user_id);
    res.redirect('/home');
  })
  .catch(err => {
    console.log(err);
    res.redirect('/home');
  })
});

app.post('/deleteSavedGame', function (req,res) {
  const query = `DELETE FROM users_to_games 
  WHERE user_id = $1
  AND game_id =$2;`;
  db.any(query, [
  req.session.user.user_id,
  req.body.deleteID
  ])
  .then(function (data) {
    console.log("Game deleted successfully");
    res.redirect('/profile');
  })
  .catch(function (err) {
    return console.log(err);
  });
})

// logout route
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/home');
});

app.listen(3000);
console.log("Server is listening on port 3000");
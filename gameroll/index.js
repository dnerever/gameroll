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

//trying to link css stylesheet -- does not work
// app.use(
//   express.static(_dirname)
// )

//another attempt to link stylesheet
//app.use(express.static(__dirname + '/'));
//app.use(express.static(__img + '/'));

app.use(express.static("resources"));

// 4. Get /
app.get('/', (req, res) =>{
  // res.redirect('/home'); //this will call the /anotherRoute route in the API
  res.redirect('pages/home');
});

// app.get('/home', (req, res) =>{
//   // res.redirect('/home'); //this will call the /anotherRoute route in the API
//   /* Changed for de-bugging purposes only - Kevin */
//   res.render('pages/home');
// });
let count = 0;
app.get('/home',(req, res) => {
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
  

  console.log("---(Count - 1) after first call: " + (count - 1) + " ---");

  randomGameId = Math.floor(Math.random() * (count -1));

  // for (let i = 0; i < randomGameIds.length; i++) {    //Loop fills the array
  //   randomGameIds[i] = Math.floor(Math.random() * (count -1));    //Sets each value of the array to a random number between 0 and the last position of the game
  // }
  // console.log("---RandomGameIds Initialized: [0]:" + randomGameIds[0] + ", [1]: " + randomGameIds[1] + ", [2]: " + randomGameIds[2] + ", [3]: " + randomGameIds[3] + ", [4]: " + randomGameIds[4] + " ---");
  // return randomGameIds[0];


});
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
          data: query + " offset " + randomGameId + "; limit 1;", 
          //data: `${query} offset  ${game_id} ; limit 2;`,
      })
      .then(results => {
          console.log(results.data); // the results will be displayed on the terminal if the docker containers are running
          // Send some parameters
          res.render('pages/home', {
            results: results,
            //count: count,   //Not being used on the home page
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

// 6. POST /register
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

// 7. GET /login
  app.get('/login', (req, res) => {
    res.render('pages/login');
  });

// 8. POST /login
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
    //Creates message when user is not signed in
    return res.redirect(`/home?message=${'You need to register or log in to use this feature!'}`);
  }
  next();
};

app.get('/nextGame', (req,res) => {
  
  var rand = Math.round(10000 * Math.random());

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
    .catch(error => {
    // Handle errors
      res.render('pages/home', {
        results: [],
        message: error.message || error
      });
  });
});

app.post('/saveGame', (req,res) => {
  console.log("helloa!!");
  //console.log(req.session.user);
    if (req.session.user){
      console.log("/saveGame User: ");
      console.log(req.session.user.email);
      //res.render('pages/profile');
    } else {
      res.render('pages/login', {message : 'Need to sign in to access this page'});
    }
    return;
});

// We don't want this because we want users to be able to see our website without having to log in 
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

  const query = `INSERT INTO games(game_name) VALUES ($1);`;

  db.any(query, [
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
  
  
// 11. GET /logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.render('pages/logout');
});

app.listen(3000);
console.log("Server is listening on port 3000");
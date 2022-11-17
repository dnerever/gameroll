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
  console.log("\n---NEW /home call---\n");
  var query = "fields name, screenshots.*, summary; where (summary != null & screenshots != null);";
  var randomGameIds = new Array(5);   //Creates a new blank array of 5 objects to store random game positions


  axios({   //We should move this call out of /home so that it is only called once when starting
    url: `https://api.igdb.com/v4/games/count`,
        method: 'POST',
        dataType:'text',
        headers: {
            "Client-ID": "5nphybqacwmj6kh3m2m0hk3unjc1gn",
            "Authorization": "Bearer fewdbr1edvvqbiughfqnu7z0ibl0bj",
        },
        data: query,  //Base query to return the number of games that match our criteria
    })
    .then(results => {
      console.log("---Game Count Determined: " + results.data.count + "---"); // the results will be displayed on the terminal if the docker containers are running
      count = results.data.count;
      //return count;
    })
    .catch(error => {
    // Handle errors
      console.log("Error with initial API count call.")
  });
  

  console.log("---(Count - 1) after first call: " + (count - 1) + " ---");

  for (let i = 0; i < randomGameIds.length; i++) {    //Loop fills the array
    randomGameIds[i] = Math.floor(Math.random() * (count -1));    //Sets each value of the array to a random number between 0 and the last position of the game
  }

  console.log("---RandomGameIds Initialized: [0]:" + randomGameIds[0] + ", [1]: " + randomGameIds[1] + ", [2]: " + randomGameIds[2] + ", [3]: " + randomGameIds[3] + ", [4]: " + randomGameIds[4] + " ---");
  axios({
      url: `https://api.igdb.com/v4/games`,
          method: 'POST',
          dataType:'text',
          headers: {
              "Client-ID": "5nphybqacwmj6kh3m2m0hk3unjc1gn",
              "Authorization": "Bearer fewdbr1edvvqbiughfqnu7z0ibl0bj",
          },
          data: query + " offset " + randomGameIds[0] + "; limit 2;", 
      })
      .then(results => {
          console.log(results.data); // the results will be displayed on the terminal if the docker containers are running
          // Send some parameters
          res.render('pages/home', {
            results: results,
            //count: count,   //Not being used on the home page
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
    return res.redirect('/home');
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
            "Client-ID": "5nphybqacwmj6kh3m2m0hk3unjc1gn",
            "Authorization": "Bearer fewdbr1edvvqbiughfqnu7z0ibl0bj",
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
    console.log(res.data);
});

// We don't want this because we want users to be able to see our website without having to log in 
  // // Authentication Required
  app.use(auth);

  app.get('/profile', (req, res) => {
    axios({
      url: "https://api.igdb.com/v4/games",
      method: 'POST',
      dataType: 'text',
      headers: {
          
          "Client-ID": " 5nphybqacwmj6kh3m2m0hk3unjc1gn",
          "Authorization": "Bearer fewdbr1edvvqbiughfqnu7z0ibl0bj",
      },
      data: "fields age_ratings,aggregated_rating,aggregated_rating_count,alternative_names,artworks,bundles,category,checksum,collection,cover,created_at,dlcs,expanded_games,expansions,external_games,first_release_date,follows,forks,franchise,franchises,game_engines,game_localizations,game_modes,genres,hypes,involved_companies,keywords,language_supports,multiplayer_modes,name,parent_game,platforms,player_perspectives,ports,rating,rating_count,release_dates,remakes,remasters,screenshots,similar_games,slug,standalone_expansions,status,storyline,summary,tags,themes,total_rating,total_rating_count,updated_at,url,version_parent,version_title,videos,websites; limit 1",
      body: "fields age_ratings,aggregated_rating,aggregated_rating_count,alternative_names,artworks,bundles,category,checksum,collection,cover,created_at,dlcs,expanded_games,expansions,external_games,first_release_date,follows,forks,franchise,franchises,game_engines,game_localizations,game_modes,genres,hypes,involved_companies,keywords,language_supports,multiplayer_modes,name,parent_game,platforms,player_perspectives,ports,rating,rating_count,release_dates,remakes,remasters,screenshots,similar_games,slug,standalone_expansions,status,storyline,summary,tags,themes,total_rating,total_rating_count,updated_at,url,version_parent,version_title,videos,websites; limit 1",
    })
      .then(games => {
          console.log(games.data);
        res.render('pages/profile', {games: data})
        })
      .catch(err => {
          res.render('pages/profile',{
            games: [],
            message: err.message || err
          });
          
      });
  });
  
  
// 11. GET /logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.render('pages/logout');
});

app.listen(3000);
console.log("Server is listening on port 3000");
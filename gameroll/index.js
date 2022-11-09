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
  // res.redirect('/home'); //this will call the /anotherRoute route in the API
  /* Changed for de-bugging purposes only - Kevin */
  res.redirect('/register');
});

app.post('/home',(req, res) => {
  axios({
      url: `https://api.igdb.com/v4/games`,
          method: 'POST',
          dataType:'json',
          params: {
              "Client-ID": "5nphybqacwmj6kh3m2m0hk3unjc1gn",
              "Authorization": "Bearer fewdbr1edvvqbiughfqnu7z0ibl0bj",
              "apikey": req.session.user.api_key,
              "keyword": "game", //you can choose any artist/event here
              "size": 10,
          }
      })
      .then(results => {
          console.log(results.data); // the results will be displayed on the terminal if the docker containers are running
      // Send some parameters
      res.render('pages/discover', {
        results: results,
      });
      })
      .catch(error => {
      // Handle errors
          res.render('pages/discover', {
            results: [],
            message: error.message || error
          });
          // console.log('ERROR:', error.message || error);
      });
});

app.get('/register', (req, res) => {
  res.render('pages/register');
});

// 6. POST /register
// Register submission
app.post('/register', async (req, res) => {
    console.log("post register");
    const test = await db.query("SELECT * FROM users;")
    console.log(test)
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

app.post('/profile', (req, res) => {
  axios({
    url: "https://api.igdb.com/v4/games",
    method: 'POST',
    headers: {
        "Accept": "application/json",
        "Client-ID": "Client ID",
        "Authorization": "Bearer access_token",
    },
    data: "fields age_ratings,aggregated_rating,aggregated_rating_count,alternative_names,artworks,bundles,category,checksum,collection,cover,created_at,dlcs,expanded_games,expansions,external_games,first_release_date,follows,forks,franchise,franchises,game_engines,game_localizations,game_modes,genres,hypes,involved_companies,keywords,language_supports,multiplayer_modes,name,parent_game,platforms,player_perspectives,ports,rating,rating_count,release_dates,remakes,remasters,screenshots,similar_games,slug,standalone_expansions,status,storyline,summary,tags,themes,total_rating,total_rating_count,updated_at,url,version_parent,version_title,videos,websites;"
  })
    .then(res => {
        console.log(res.data);
      res.render('pages/profile', {game: game.data})
      })
    .catch(err => {
        res.render('pages/home');
        return console.log(err);
    });
});

  
// 9. Authentication middleware

const auth = (req, res, next) => {
  if (!req.session.user) {
    // Default to register page.
    return res.redirect('/register');
  }
  next();
};

// We don't want this because we want users to be able to see our website without having to log in 
  // // Authentication Required
  // app.use(auth);

// 10. GET /discover
app.get('/profile',(req, res) => {
    res.render("pages/profile");
  });

// 11. GET /logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.render('pages/logout');
});




app.listen(3000);
console.log("Server is listening on port 3000");
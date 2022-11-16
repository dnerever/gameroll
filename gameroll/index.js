const express = require('express');
const app = express();
const pgp = require('pg-promise')();
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const axios = require('axios');
const { render } = require('ejs');
const { response } = require('express');


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

app.get('/nextGame', (req,res) => {
  
  var rand = Math.round(10000 * Math.random());
  console.log("Rand:");
  console.log(rand);
  res.render('pages/home',{results: results[rand].data});
});

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

app.get('/home',(req, res) => {
  axios({
      url: `https://api.igdb.com/v4/games`,
          method: 'POST',
          dataType:'text',
          headers: {
              "Client-ID": "5nphybqacwmj6kh3m2m0hk3unjc1gn",
              "Authorization": "Bearer fewdbr1edvvqbiughfqnu7z0ibl0bj",
          },
          data: "fields name, screenshots.*, summary; where (rating > 75 & rating_count > 5 & summary != null & screenshots != null); limit 5;",  //working with data[3] - otter bash!
      })
      .then(results => {
          console.log(results.data); // the results will be displayed on the terminal if the docker containers are running
          // Send some parameters
          res.render('pages/home', {
            results: results,
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
        res.redirect('/home');
      }else{
        res.redirect('/login');
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
  
// 9. Authentication middleware

const auth = (req, res, next) => {
  if (!req.session.user) {
    // Default to register page.
    return res.redirect('/home');
  }
  next();
};

// We don't want this because we want users to be able to see our website without having to log in 
  // // Authentication Required
  app.use(auth);

// 10. GET /discover
app.get('/profile',(req, res) => {
    res.render("pages/profile", {game: []} );
  });






app.listen(3000);
console.log("Server is listening on port 3000");
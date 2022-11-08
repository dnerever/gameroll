DROP TABLE IF EXISTS users CASCADE;
CREATE TABLE users(
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(100) NOT NULL,
    password VARCHAR(100) NOT NULL
);

DROP TABLE IF EXISTS users_to_games CASCADE;
CREATE TABLE users_to_games(
  user_id INT NOT NULL,
  game_id INT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (user_id),
  FOREIGN KEY (game_id) REFERENCES games_to_api (game_id)
);

DROP TABLE IF EXISTS games CASCADE;
CREATE TABLE games(
    game_id PRIMARY KEY
);

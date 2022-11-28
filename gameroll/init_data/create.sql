DROP TABLE IF EXISTS users CASCADE;
CREATE TABLE users(
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(100) NOT NULL,
    password VARCHAR(100) NOT NULL
);

DROP TABLE IF EXISTS games CASCADE;
CREATE TABLE games(
    game_id INT PRIMARY KEY,
    game_name VARCHAR(200)
);


DROP TABLE IF EXISTS users_to_games CASCADE;
CREATE TABLE users_to_games(
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (game_id) REFERENCES games(game_id)
);

DROP TABLE IF EXISTS game_genres CASCADE;
CREATE TABLE game_genres(
    table_id INT PRIMARY KEY,
    genre_id INT NOT NULL,
    name VARCHAR(100) NOT NULL
);
// Dependencies
var express = require("express");
//var mongojs = require("mongojs");
var logger = require("morgan");
var mongoose = require("mongoose");
// Require axios and cheerio. This makes the scraping possible
var axios = require("axios");
var cheerio = require("cheerio");

// Require all models
var db = require("./models");

// If deployed, use the deployed database. Otherwise use the local mongoHeadlines database
var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/mongoHeadlines";

mongoose.connect(MONGODB_URI);

var PORT = proces.env.PORT || 3000;

// Initialize Express
var app = express();

// Configure middleware

// Use morgan logger for logging requests
app.use(logger("dev"));
// Parse request body as JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Set up a static folder (public) for our web app
app.use(express.static("public"));

// Connect to the Mongo DB
//mongoose.connect("mongodb://localhost/newsScraper", { useNewUrlParser: true });

// Set Handlebars.
var exphbs = require("express-handlebars");

app.engine("handlebars", exphbs({ defaultLayout: "main" }));
app.set("view engine", "handlebars");

// Database configuration
// var databaseUrl = "newsScraper";
// var collections = ["scrapedNewsData"];

// Hook mongojs configuration to the db variable
// var db = mongojs(databaseUrl, collections);
// db.on("error", function(error) {
//   console.log("Database Error:", error);
// });

// Main route (simple Hello World Message)
// app.get("/", function (req, res) {
//   res.render("index");
// });

// Retrieve data from the db
// app.get("/", function (req, res) {
//   // Find all results from the scrapedData collection in the db
//   db.Article.find({}, function (error, found) {
//     var hbsObject = {
//       articles: found
//     }
//     // Throw any errors to the console
//     if (error) {
//       console.log(error);
//     }
//     // If there are no errors, send the data to the browser as json
//     else {
//       res.render("index", hbsObject);
//     }
//   });
// });

// Route for getting all Articles from the db
app.get("/saved", function (req, res) {
  // Grab every document in the Articles collection
  db.Article.find({saved: true})
    .then(function (dbArticle) {
      // If we were able to successfully find Articles, send them back to the client
      var hbsObject = {
        savedArticles: dbArticle
      }
      res.render("saved", hbsObject);
    })
    .catch(function (err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Route for getting all Articles from the db
app.get("/", function (req, res) {
  // Grab every document in the Articles collection
  db.Article.find({})
    .then(function (dbArticle) {
      // If we were able to successfully find Articles, send them back to the client
      var hbsObject = {
        articles: dbArticle
      }
      res.render("index", hbsObject);
    })
    .catch(function (err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});


// Scrape data from one site and place it into the mongodb db
app.get("/scrape", function (req, res) {
  var result;

  for (var i = 2; i < 15; i++) {


  // Make a request via axios for the news section of `ycombinator`
  axios.get("https://www.foodandwine.com/wine?page=" + [i]).then(function (response) {
    // Load the html body from axios into cheerio
    var $ = cheerio.load(response.data);
    // For each element with a "title" class
    $(".type-article").each(function (i, element) {

      result = {};

      // Save the text and href of each link enclosed in the current element
      result.title = $(this).children("div").children("h3").children("a").text().trim();
      result.image = $(this).children("a.media-img").children("div").attr("data-src");
      var relativeLink = $(this).children("div").children("h3").children("a").attr("href");
      result.link = "https://www.foodandwine.com" + relativeLink;
      result.saved = false;

      // Create a new Article using the `result` object built from scraping
      db.Article.create(result)
        .then(function (dbArticle) {
          // View the added result in the console
          console.log(dbArticle);
        })
        .catch(function (err) {
          // If an error occurred, log it
          console.log(err);
        });

    });
    res.send(result);
    console.log(result);
  });
};
  // Send a "Scrape Complete" message to the browser
  // res.send(result);
  // console.log(result);
});

// Route for grabbing a specific Article by id, populate it with it's note
app.get("/articles/:id", function (req, res) {
  // Using the id passed in the id parameter, prepare a query that finds the matching one in our db...
  db.Article.findOne({ _id: req.params.id })
    // ..and populate all of the notes associated with it
    .populate("note")
    .then(function (dbArticle) {
      // If we were able to successfully find an Article with the given id, send it back to the client
      res.json(dbArticle);
    })
    .catch(function (err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Route for saving/updating an Article's associated Note
app.post("/articles/:id", function (req, res) {
  // Create a new note and pass the req.body to the entry
  db.Note.create(req.body)
    .then(function (dbNote) {
      // If a Note was created successfully, find one Article with an `_id` equal to `req.params.id`. Update the Article to be associated with the new Note
      // { new: true } tells the query that we want it to return the updated User -- it returns the original by default
      // Since our mongoose query returns a promise, we can chain another `.then` which receives the result of the query
      return db.Article.findOneAndUpdate({ _id: req.params.id }, { note: dbNote._id }, { new: true });
    })
    .then(function (dbArticle) {
      // If we were able to successfully update an Article, send it back to the client
      res.send(dbArticle);
    })
    .catch(function (err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Update just one note by an id
app.post("/save/:id", function(req, res) {

  db.Article.update(
    {
      _id: req.params.id
    },
    {
      // Set the title, note and modified parameters
      // sent in the req body.
      $set: {
        saved: true
      }
    },
    function(error, edited) {
      // Log any errors from mongojs
      if (error) {
        console.log(error);
        res.send(error);
      }
      else {
        // Otherwise, send the mongojs response to the browser
        // This will fire off the success function of the ajax request
        console.log(edited);
        res.send(edited);
      }
    }
  );
});

// Update just one note by an id
app.post("/unsave/:id", function(req, res) {

  db.Article.update(
    {
      _id: req.params.id
    },
    {
      // Set the title, note and modified parameters
      // sent in the req body.
      $set: {
        saved: false
      }
    },
    function(error, edited) {
      // Log any errors from mongojs
      if (error) {
        console.log(error);
        res.send(error);
      }
      else {
        // Otherwise, send the mongojs response to the browser
        // This will fire off the success function of the ajax request
        console.log(edited);
        res.send(edited);
      }
    }
  );
});


// Clear the DB
app.get("/clear", function (req, res) {
  // Remove every note from the notes collection
  db.Article.remove({saved: false}, function (error, response) {
    // Log any errors to the console
    if (error) {
      console.log(error);
      res.send(error);
    }
    else {
      // Otherwise, send the mongojs response to the browser
      // This will fire off the success function of the ajax request
      console.log(response);
      res.send(response);
    }
  });
});


// Listen on port 3000
app.listen(PORT, function () {
  console.log("App running on port " + PORT + "!");
});

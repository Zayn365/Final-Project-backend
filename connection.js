require('dotenv').config();

const mongoose = require('mongoose');

const ConnectionSTR = `mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@practicedb.vr32kzn.mongodb.net/Ecom_New`;

mongoose.connect(ConnectionSTR)
.then(() => console.log("Connected to MongoDB"))
.catch((error) => console.log("NOT CONNECTED" , error));

mongoose.connection.on('error' , (error) => {
console.log(error);
});


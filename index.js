const express = require('express');
const formidable = require('formidable');
const { google } = require('googleapis');
const fs = require('fs');

// Initialize the Express app
const app = express();

// Placeholder for storing credentials temporarily
let credentials = null;
let drive = null;

// Set up Google Auth and Drive API client
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const DRIVE_FOLDER_ID = '11ZmcxTCKO2RMOzbUyDbhfWrz0oUqhHxd';  // Replace with your folder ID

async function authenticate(credentialsPath) {
  const auth = new google.auth.GoogleAuth({
    credentials: credentialsPath,
    scopes: SCOPES,
  });
  const authClient = await auth.getClient();
  return google.drive({ version: 'v3', auth: authClient });
}

// Serve static HTML for file upload
app.use(express.static('public'));

// Handle credentials upload first
app.post('/upload-credentials', (req, res) => {
  const form = new formidable.IncomingForm();

  form.parse(req, (err, fields, files) => {
    if (err) {
      return res.status(500).send('Error processing credentials');
    }

    // Read the credentials JSON file
    const credentialsPath = files.credentials[0].filepath;

    fs.readFile(credentialsPath, (err, data) => {
      if (err) {
        return res.status(500).send('Error reading credentials file');
      }

      // Store credentials in memory (for use in future requests)
      credentials = JSON.parse(data);

      // Authenticate with the Google API
      authenticate(credentials).then((driveApi) => {
        drive = driveApi;
        res.send('Credentials uploaded and authenticated successfully!');
      }).catch((authError) => {
        res.status(500).send('Failed to authenticate with Google Drive');
        console.error(authError);
      });
    });
  });
});

// Upload a file to Google Drive once credentials are uploaded
app.post('/upload', (req, res) => {
  if (!drive) {
    return res.status(400).send('Please upload credentials first');
  }

  const form = new formidable.IncomingForm();
  form.parse(req, (err, fields, files) => {
    if (err) {
      return res.status(500).send('Error uploading file');
    }

    const uploadedFile = files.file[0]; // Use files.file[0] for a single upload

    const fileMetadata = {
      name: uploadedFile.originalFilename,
      parents: [DRIVE_FOLDER_ID],  // Upload the file to this folder
    };
    const media = {
      mimeType: uploadedFile.mimetype,
      body: fs.createReadStream(uploadedFile.filepath),
    };

    drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id',
    })
    .then(response => {
      res.send(`File uploaded successfully! File ID: ${response.data.id}`);
    })
    .catch(error => {
      res.status(500).send('Error uploading file to Google Drive');
      console.error(error);
    });
  });
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

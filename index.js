const express = require('express');
const formidable = require('formidable');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

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

// Serve static HTML, CSS, and JS for file upload
app.use(express.static('public'));

// Endpoint for real-time progress
let clients = [];
app.get('/progress', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  clients.push(res);

  req.on('close', () => {
    clients = clients.filter(client => client !== res);
  });
});

// Send progress updates to clients
function sendProgress(progress) {
  clients.forEach((res) => res.write(`data: ${progress}\n\n`));
}

// Handle credentials upload first
app.post('/upload-credentials', (req, res) => {
  const form = new formidable.IncomingForm();

  form.parse(req, (err, fields, files) => {
    if (err) {
      return res.status(500).send('Error processing credentials');
    }

    const credentialsPath = files.credentials[0].filepath;

    fs.readFile(credentialsPath, (err, data) => {
      if (err) {
        return res.status(500).send('Error reading credentials file');
      }

      credentials = JSON.parse(data);

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

    const uploadedFile = files.file[0];

    const fileMetadata = {
      name: uploadedFile.originalFilename,
      parents: [DRIVE_FOLDER_ID],
    };

    const media = {
      mimeType: uploadedFile.mimetype,
      body: fs.createReadStream(uploadedFile.filepath),
    };

    drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id',
      supportsAllDrives: true,
      uploadType: 'resumable',
    }, {
      onUploadProgress: (evt) => {
        const progress = Math.floor((evt.bytesRead / uploadedFile.size) * 100);
        console.log(`Upload Progress: ${progress}%`);
        sendProgress(progress);
      }
    })
      .then(response => {
        res.send(`File uploaded successfully! File ID: ${response.data.id}`);
        sendProgress(100);
      })
      .catch(error => {
        res.status(500).send('Error uploading file to Google Drive');
        console.error(error);
        sendProgress(-1);
      });
  });
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

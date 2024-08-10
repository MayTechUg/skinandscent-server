import express from 'express';
import { google } from 'googleapis';
import multer from 'multer';
import path from 'path';
import bodyParser from 'body-parser';
import cors from 'cors';
import { Readable } from 'stream';
import { fileURLToPath } from 'url'; 
import dotenv from 'dotenv';
import 'dotenv/config';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// CORS configuration
const corsOptions = {
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
};

app.use(cors(corsOptions));
app.options('*', cors()); // Handle pre-flight requests
app.use(bodyParser.json());

// Function to authenticate with Google API
const authenticateGoogle = () => {
    const googleCloudKeyJson = Buffer.from(process.env.GOOGLE_CLOUD_KEY, 'base64').toString('utf-8');
    return new google.auth.GoogleAuth({
        credentials: JSON.parse(googleCloudKeyJson),
        scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
};

// Default route
app.get('/', (req, res) => {
    res.send('Welcome to the Google Drive API service!');
});

// Upload file to Google Drive
app.post('/upload', upload.single('file'), async (req, res) => {
    console.log('Request Body:', req.body);
    console.log('File:', req.file);

    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const { text, price, type, category, collection, description, howToUse, priceTwo } = req.body;
    const auth = authenticateGoogle();
    const driveService = google.drive({ version: 'v3', auth });

    const fileMetadata = {
        name: req.file.originalname,
        parents: ['1NaakyaShsd3vtR5hpm37z8AeLMbT4z0O'], // Replace with your folder ID
        description: JSON.stringify({ text, price, type, category, collection, description, howToUse, priceTwo })
    };
    const media = {
        mimeType: req.file.mimetype,
        body: Readable.from(req.file.buffer),  // Use Readable stream from buffer
    };

    try {
        const file = await driveService.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id',
        });
        res.status(200).json({ id: file.data.id });
    } catch (error) {
        console.error('Error uploading to Google Drive:', error);
        res.status(500).send(error.message);
    }
});

// List files in Google Drive
app.get('/list', async (req, res) => {
    const auth = authenticateGoogle();
    const driveService = google.drive({ version: 'v3', auth });

    try {
        const response = await driveService.files.list({
            q: `'1NaakyaShsd3vtR5hpm37z8AeLMbT4z0O' in parents`, // Replace with your folder ID
            fields: 'files(id, name, webContentLink, description)',
        });

        const files = response.data.files.map(file => {
            const fileId = file.id;
            const directLink = `https://drive.google.com/thumbnail?id=${fileId}`;
            const description = file.description ? JSON.parse(file.description) : {};
            return {
                id: fileId,
                text: file.name,
                image: directLink,
                price: description.price || '0',
                category: description.category || '',
                collection: description.collection || '',
                type: description.type || '',
                description: description.description || '',
                howToUse: description.howToUse || '',
                priceTwo: description.priceTwo || '',
            };
        });

        res.status(200).json(files);
    } catch (error) {
        console.error('Error listing files from Google Drive:', error);
        res.status(500).send(error.message);
    }
});

// Update a file on Google Drive
async function updateFile(fileId, fileMetadata, media) {
    const auth = authenticateGoogle();
    const driveService = google.drive({ version: 'v3', auth });

    try {
        const response = await driveService.files.update({
            fileId: fileId,
            media: media,
            requestBody: fileMetadata,
            fields: 'id, name',
        });
        console.log(`File updated: ${response.data.name}`);
        return response.data;
    } catch (error) {
        console.error('Error updating file:', error);
        throw error;
    }
}

app.post('/update', upload.single('file'), async (req, res) => {
    const { fileId, text, price, type, category, collection, description, howToUse, priceTwo } = req.body;

    if (!fileId) {
        return res.status(400).send('fileId is required.');
    }

    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const fileMetadata = {
        name: req.file.originalname,
        description: JSON.stringify({ text, price, type, category, collection, description, howToUse, priceTwo })
    };

    const media = {
        mimeType: req.file.mimetype,
        body: Readable.from(req.file.buffer),
    };

    try {
        const updatedFile = await updateFile(fileId, fileMetadata, media);
        res.status(200).json(updatedFile);
    } catch (error) {
        console.error('Error updating file:', error);
        res.status(500).send(error.message);
    }
});

// Delete a file from Google Drive
async function deleteFile(fileId) {
    const auth = authenticateGoogle();
    const driveService = google.drive({ version: 'v3', auth });

    try {
        await driveService.files.delete({
            fileId: fileId,
        });
        console.log(`File deleted: ${fileId}`);
    } catch (error) {
        console.error('Error deleting file:', error);
        throw error;
    }
}

app.post('/delete', async (req, res) => {
    const { fileId } = req.body;

    if (!fileId) {
        return res.status(400).send('fileId is required.');
    }

    try {
        await deleteFile(fileId);
        res.status(200).send(`File deleted: ${fileId}`);
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).send(error.message);
    }
});

const port = process.env.PORT || 5001;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

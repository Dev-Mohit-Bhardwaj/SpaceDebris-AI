# SpaceDebris-AI Project

## 🚀 Getting Started

After cloning this repository, follow these steps to set up the environment:

---

### 1. Clone the Repository
```bash
git clone https://github.com/Dev-Mohit-Bhardwaj/SpaceDebris-AI.git
cd SpaceDebris-AI

#pulling the data files
git lfs install
git lfs pull

# Backkend setup 
cd backend

# Create virtual environment
python -m venv venv

# Activate environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt



#Frontend Setup
cd ../frontend

# Install dependencies
npm install

# Start development server
npm.cmd run dev



```

---

### 2. Run the Backend

Open a new terminal and run the backend server:

```bash
cd backend
python main.py
```

The backend will start and load the pre-trained machine learning model (`model.pkl`).

---

### 3. Run the Frontend

Open another terminal and start the frontend:

```bash
cd frontend
npm run dev
```

Once the development server starts, open the URL displayed in the terminal (typically `http://localhost:5173`) in your web browser.

---



### 4. Quick Launch (Windows)

Windows users can alternatively launch the project using:

```bash
Start_SpaceDebris.bat
```

This script automatically starts the required components for the project.

---

### 5. Troubleshooting

#### Python packages not installed

```bash
cd backend
pip install -r requirements.txt
```

#### Frontend dependencies missing

```bash
cd frontend
npm install
```

#### Dataset files missing

If large data files are not downloaded properly, run:

```bash
git lfs install
git lfs pull
```

#### Python command not found

Ensure Python 3.10 or later is installed and added to your system PATH.

#### npm command not found

Install the latest LTS version of Node.js, which includes npm.



## ⭐ Thank You

Thank you for checking out the **SpaceDebris-AI** project.

If you found this project useful, consider giving the repository a ⭐ on GitHub to support our work!

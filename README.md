# SpaceDebris-AI Project

## 🚀 Getting Started

After cloning this repository, follow these steps to set up the environment:

---

### 1. Clone the Repository
```bash
git clone https://github.com/Dev-Mohit-Bhardwaj/SpaceDebris-AI.git
cd SpaceDebris-AI


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
npm start


#pulling the data files
git lfs install
git lfs pull

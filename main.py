# main.py
from fastapi import FastAPI, Request
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import faiss
import google.generativeai as genai
import os
from typing import List

app = FastAPI()

# Setup templates and static files
templates = Jinja2Templates(directory="templates")
app.mount("/static", StaticFiles(directory="static"), name="static")

# Load model and FAISS index
model = SentenceTransformer('all-MiniLM-L6-v2')
index = faiss.read_index('faiss_index/index.faiss')

# Load chunks
with open('faiss_index/chunks.txt', 'r', encoding='utf-8') as f:
    chunks = [line.strip() for line in f if line.strip()]

class QueryRequest(BaseModel):
    query: str
    api_key: str
    top_k: int = 3

class SearchRequest(BaseModel):
    query: str
    top_k: int = 3

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/search")
async def search_chunks(request: SearchRequest):
    """Search for relevant chunks using FAISS"""
    try:
        # Generate embedding for query
        query_embedding = model.encode([request.query])
        
        # Search in FAISS index
        distances, indices = index.search(query_embedding, k=request.top_k)
        
        # Get relevant chunks
        results = []
        for i, idx in enumerate(indices[0]):
            if idx < len(chunks):
                results.append({
                    "chunk": chunks[idx],
                    "distance": float(distances[0][i]),
                    "index": int(idx)
                })
        
        return JSONResponse(content={
            "success": True,
            "results": results
        })
    except Exception as e:
        return JSONResponse(content={
            "success": False,
            "error": str(e)
        }, status_code=500)

@app.post("/chat")
async def chat(request: QueryRequest):
    """Get AI response using Gemini"""
    try:
        # Search for relevant chunks
        query_embedding = model.encode([request.query])
        distances, indices = index.search(query_embedding, k=request.top_k)
        
        relevant_chunks = [chunks[idx] for idx in indices[0] if idx < len(chunks)]
        
        if not relevant_chunks:
            return JSONResponse(content={
                "success": False,
                "error": "No relevant information found in the knowledge base."
            })
        
        # Build context
        context = "\n\n".join(relevant_chunks)
        
        # Configure Gemini
        genai.configure(api_key='AIzaSyD_DsKtHUVSgkqQYz7lSIMks8qIAXv5ClE')
        print(context)
        model_gemini = genai.GenerativeModel(
    model_name="models/gemini-2.5-flash"
)
        
        # Create prompt
        prompt = f"""You are a helpful assistant. Answer the user's question based ONLY on the following context from the knowledge base. If the answer isn't in the context, say so clearly.

        Be friendly with the user answer greeting in polite way also.
Context:
{context}

Question: {request.query}

Answer:"""
        
        # Generate response
        response = model_gemini.generate_content(prompt)
        
        return JSONResponse(content={
            "success": True,
            "answer": response.text,
            "chunks_used": len(relevant_chunks)
        })
    
    except Exception as e:
        return JSONResponse(content={
            "success": False,
            "error": str(e)
        }, status_code=500)

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "chunks_loaded": len(chunks),
        "index_size": index.ntotal
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
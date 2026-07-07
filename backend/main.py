import pandas as pd
import random
import math
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import pickle
import array

try:
    from deap import base, creator, tools, algorithms
except ImportError:
    pass

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

with open("model.pkl", "rb") as f:
    model = pickle.load(f)

cache = {"debris_pool": [], "debris_results": []}

def init_debris_pool():
    pool = []
    for i in range(804):
        altitude = random.uniform(6600, 8500) 
        angle1 = random.uniform(0, 2 * math.pi)
        angle2 = math.acos(2 * random.uniform(0, 1) - 1)
        speed = random.uniform(0.01, 0.04) # physical orbital velocity
        
        is_satellite = random.random() < 0.15
        obj_type = "satellite" if is_satellite else "debris"
        is_danger_inject = random.random() < 0.12 and obj_type == "debris"
        
        # Determine base risk statically
        features = pd.DataFrame([{
            "time_to_tca": random.uniform(0.1, 1.0) if is_danger_inject else random.uniform(2.0, 10.0),
            "miss_distance": random.uniform(10, 500) if is_danger_inject else random.uniform(5000, 50000),
            "relative_speed": random.uniform(12000, 16000) if is_danger_inject else random.uniform(100, 10000),
            "relative_position_r": 0, "relative_position_t": 0, "relative_position_n": 0,
            "relative_velocity_r": 0, "relative_velocity_t": 0, "relative_velocity_n": 0
        }])
        
        risk_pred = float(model.predict(features)[0])
        ui_risk = max(0, min(1, 1 - (risk_pred / -10.0)))
        
        is_high_risk = False
        if obj_type == "debris" and (is_danger_inject or ui_risk > 0.7):
            is_high_risk = True
            
        pool.append({
            "name": f"SIM-{i}",
            "type": obj_type,
            "altitude": altitude,
            "angle1": angle1,
            "angle2": angle2,
            "speed": speed,
            "risk_score": random.uniform(0.9, 0.99) if is_high_risk else ui_risk,
            "is_high_risk": is_high_risk
        })

    # Ensure enough targets for Optimizer demo
    if sum(1 for d in pool if d.get("is_high_risk")) < 20:
        for i, d in enumerate(pool):
            if i % 8 == 0:
                d["type"] = "debris"
                d["is_high_risk"] = True
                d["risk_score"] = random.uniform(0.88, 0.99)
                
    return pool

@app.get("/debris")
def get_debris_data():
    if not cache.get("debris_pool"):
        cache["debris_pool"] = init_debris_pool()
        
    results = []
    
    # Safely step Physics Simulator forward
    for d in cache["debris_pool"]:
        d["angle1"] += d["speed"] # Orbit moves linearly!
        
        x = d["altitude"] * math.sin(d["angle2"]) * math.cos(d["angle1"])
        y = d["altitude"] * math.sin(d["angle2"]) * math.sin(d["angle1"])
        z = d["altitude"] * math.cos(d["angle2"])
        
        results.append({
            "name": d["name"],
            "type": d["type"],
            "position": [x, y, z],
            "risk_score": d["risk_score"],
            "is_high_risk": d["is_high_risk"]
        })

    cache["debris_results"] = results
    
    return {
        "status": "success", 
        "count": len(results), 
        "data": results
    }

# Initialize DEAP Framework globally to prevent class re-definition warnings
if 'creator' in globals():
    if not hasattr(creator, "FitnessMin"):
        creator.create("FitnessMin", base.Fitness, weights=(-1.0,))
    if not hasattr(creator, "Individual"):
        creator.create("Individual", array.array, typecode='i', fitness=creator.FitnessMin)

@app.get("/optimize")
def run_optimization():
    results = cache.get("debris_results", [])
    if not results:
        return {"status": "error", "message": "No data found."}
    
    # 1. Selection Module & DEAP Knapsack Objective
    high_risk_targets = [d for d in results if d.get("is_high_risk")]
    # Limit to TOP 25 extreme risks so GA runs under 1 second for user responsiveness
    high_risk_targets = sorted(high_risk_targets, key=lambda x: x["risk_score"], reverse=True)[:25]
    
    if len(high_risk_targets) < 2:
        return {"status": "success", "route": []}
        
    num_targets = len(high_risk_targets)
        
    # Build Fuel Cost (Distance) Matrix
    dist_matrix = [[0] * num_targets for _ in range(num_targets)]
    for i in range(num_targets):
        for j in range(num_targets):
            p1 = high_risk_targets[i]["position"]
            p2 = high_risk_targets[j]["position"]
            dist_matrix[i][j] = math.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2 + (p1[2]-p2[2])**2)
            
    # Quick Greedy/Naive Baseline eval for calculating "Fuel Savings"
    naive_route = list(range(num_targets))
    random.shuffle(naive_route)
    baseline_dist = sum([dist_matrix[naive_route[i]][naive_route[i+1]] for i in range(len(naive_route)-1)])

    # 2. DEAP Genetic Algorithm TSP Route
    if 'creator' in globals():
        toolbox = base.Toolbox()
        toolbox.register("indices", random.sample, range(num_targets), num_targets)
        toolbox.register("individual", tools.initIterate, creator.Individual, toolbox.indices)
        toolbox.register("population", tools.initRepeat, list, toolbox.individual)
        
        def evalTSP(individual):
            distance = 0
            for i in range(len(individual) - 1):
                distance += dist_matrix[individual[i]][individual[i+1]]
            return (distance,)
            
        toolbox.register("mate", tools.cxPartialyMatched)
        toolbox.register("mutate", tools.mutShuffleIndexes, indpb=0.05)
        toolbox.register("select", tools.selTournament, tournsize=3)
        toolbox.register("evaluate", evalTSP)
        
        pop = toolbox.population(n=40)
        hof = tools.HallOfFame(1)
        
        # We need numpy for some tools, but let's just use standard min safely 
        stats = tools.Statistics(lambda ind: ind.fitness.values[0])
        stats.register("min", min)
        
        pop, logbook = algorithms.eaSimple(pop, toolbox, 0.7, 0.2, 40, stats=stats, halloffame=hof, verbose=False)
        
        best_route = hof[0]
        best_dist = evalTSP(best_route)[0]
        convergence_history = logbook.select("min")
    else:
        # Fallback Greedy if DEAP missing
        best_route = naive_route
        best_dist = baseline_dist
        convergence_history = []
        
    fuel_saved = max(0, baseline_dist - best_dist)
    route_coords = [high_risk_targets[i]["position"] for i in best_route]
    
    return {
        "status": "success", 
        "route": route_coords,
        "metrics": {
            "targets_neutralized": num_targets,
            "optimized_distance_km": round(best_dist, 2),
            "fuel_saved_km": round(fuel_saved, 2),
            "convergence_history": convergence_history
        }
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

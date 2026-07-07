import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Line } from '@react-three/drei';
import * as THREE from 'three';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const Earth = () => {
  const earthGroupRef = useRef();
  
  // Fetch real cinematic maps from reliable CDNs (Removed GitHub RAW to fix CORS Black Screen Fatal Crash)
  const [colorMap, bumpMap, specularMap] = useLoader(THREE.TextureLoader, [
    'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
    'https://unpkg.com/three-globe/example/img/earth-topology.png',
    'https://unpkg.com/three-globe/example/img/earth-water.png'
  ]);
  
  useFrame(() => {
    if (earthGroupRef.current) {
      earthGroupRef.current.rotation.y += 0.0005; // Core planet rotates
    }
  });

  return (
    <mesh ref={earthGroupRef}>
      <sphereGeometry args={[2, 64, 64]} />
      <meshPhongMaterial 
        map={colorMap} 
        bumpMap={bumpMap}
        bumpScale={0.02}
        specularMap={specularMap}
        specular={new THREE.Color('grey')}
        shininess={15}
      />
    </mesh>
  );
};

// Map real SGP4 km coordinates to our custom 3D scale (Radius = 2 for Earth)
const SCALE = 2 / 6371.0; 

const HoverOrbit = ({ item }) => {
  const x = item.position[0] * SCALE;
  const y = item.position[2] * SCALE;
  const z = -item.position[1] * SCALE;

  const radius = Math.sqrt(x*x + y*y + z*z);
  const normal = new THREE.Vector3(x, y, z).normalize();
  const up = Math.abs(normal.y) > 0.99 ? new THREE.Vector3(1,0,0) : new THREE.Vector3(0,1,0);
  const orbitNormal = new THREE.Vector3().crossVectors(normal, up).normalize();
  
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1), orbitNormal);
  
  let color = '#00ffff';
  if (item.type === 'satellite') color = '#00ff77';
  if (item.is_high_risk) color = '#ff1100';

  return (
    <mesh position={[0,0,0]} quaternion={quaternion}>
      <torusGeometry args={[radius, 0.005, 16, 120]} />
      <meshBasicMaterial color={color} transparent opacity={0.65} depthTest={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
};

const DebrisCloud = ({ data, setHoveredItem }) => {
  const meshRef = useRef();
  
  useEffect(() => {
    if (!meshRef.current || data.length === 0) return;
    
    const dummy = new THREE.Object3D();
    
    data.forEach((item, i) => {
      // SGP4 r vector is [x, y, z] in km. Swap Y and Z for three.js space
      const x = item.position[0] * SCALE;
      const y = item.position[2] * SCALE; 
      const z = -item.position[1] * SCALE;
      
      dummy.position.set(x, y, z);
      
      // Inflate riskier objects for visual drama 
      const s = item.is_high_risk ? 0.04 : 0.015;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      
      // Neon colors mapping based on Type
      let color;
      if (item.type === 'satellite') {
        color = new THREE.Color('#00ff77'); // Green for Active Satellites
      } else if (item.is_high_risk) {
        color = new THREE.Color('#ff1100'); // Red for Dangerous Debris
      } else {
        color = new THREE.Color('#00ffff'); // Cyan for ordinary Debris
      }
      meshRef.current.setColorAt(i, color);
    });
    
    meshRef.current.instanceMatrix.needsUpdate = true;
    if(meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    
    // Explicitly guarantee Bounding Sphere is initialized on Data Parse so the raycaster natively locks
    meshRef.current.computeBoundingSphere();
  }, [data]);

  // Actual 'Pulsing' Animation for High Risk Red Debris!
  useFrame((state) => {
    if (!meshRef.current || data.length === 0) return;
    const time = state.clock.getElapsedTime();
    const dummy = new THREE.Object3D();
    
    let needsUpdate = false;
    for (let i = 0; i < data.length; i++) {
        if (data[i].is_high_risk) {
            meshRef.current.getMatrixAt(i, dummy.matrix);
            dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
            
            // Rapid sine wave pulsing effect
            const baseScale = 0.04;
            const s = baseScale + Math.sin(time * 5 + i) * 0.015;
            dummy.scale.set(s, s, s);
            
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
            needsUpdate = true;
        }
    }
    if (needsUpdate) {
        meshRef.current.instanceMatrix.needsUpdate = true;
    }
    // Prevent Red Debris pulsing sizes from throwing off Native Raycaster hits
    meshRef.current.computeBoundingSphere();
  });

  return (
    <instancedMesh 
        ref={meshRef} 
        args={[null, null, Math.max(1, data.length)]}
        onPointerMove={(e) => {
            e.stopPropagation();
            if (e.instanceId !== undefined && data[e.instanceId]) {
                setHoveredItem(data[e.instanceId]);
                document.body.style.cursor = 'crosshair';
            }
        }}
        onPointerOut={() => {
            setHoveredItem(null);
            document.body.style.cursor = 'default';
        }}
    >
      <sphereGeometry args={[1, 16, 16]} />
      {/* Emissive tone mapping disabled for pure neon burn effect */}
      <meshStandardMaterial toneMapped={false} emissiveIntensity={2.5} />
    </instancedMesh>
  );
};

const WormholeTunnel = ({ appState }) => {
  const meshRef = useRef();
  
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += (appState === 'warping' ? 0.08 : 0.002); // Spin violently during hyperspace
    }
  });

  if (appState === 'dashboard') return null;

  return (
    <mesh ref={meshRef} position={[0,0,100]} rotation={[Math.PI/2, 0, 0]}>
      {/* Massive Funnel: TopRadius=30(front), BotRadius=5(earth), Length=800 */}
      <cylinderGeometry args={[45, 8, 1200, 32, 100, true]} />
      <meshBasicMaterial 
        color="#00aaff" 
        wireframe={true} 
        transparent 
        opacity={appState === 'warping' ? 0.5 : 0.15} 
        side={THREE.DoubleSide} 
      />
    </mesh>
  );
};

const CameraRig = ({ appState, setAppState }) => {
  const { camera } = useThree();
  
  useEffect(() => {
    if (appState === 'intro') {
      camera.position.set(0, 0, 700); // Deep Space Starting Point
      camera.lookAt(0,0,0);
    }
  }, [appState, camera]);

  useFrame(() => {
    if (appState === 'warping') {
      // Lerp camera fast towards Earth at Z=9
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, 9, 0.05);
      
      // Hyperdrive Screenshake Effect
      if (camera.position.z > 50) {
        camera.position.x = (Math.random() - 0.5) * 3.0;
        camera.position.y = (Math.random() - 0.5) * 3.0;
      } else {
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, 0, 0.1);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, 2.5, 0.1);
      }
      
      // Stop sequence when close to Earth orbit
      if (camera.position.z <= 9.5) {
        camera.position.set(0, 2.5, 9);
        setAppState('dashboard');
      }
    }
  });
  return null;
};

export default function App() {
  const [appState, setAppState] = useState('intro'); // 'intro', 'warping', 'dashboard'
  const [debrisData, setDebrisData] = useState([]);
  const [stats, setStats] = useState({ total: 0, highRisk: 0, safe: 0, warn: 0, crit: 0 });
  const [cleanupRoute, setCleanupRoute] = useState(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [aiMetrics, setAiMetrics] = useState(null);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("http://localhost:8000/debris");
        if(res.ok) {
           const json = await res.json();
           if (json.status === "success" && json.data) {
             setDebrisData(json.data);
             const highRiskCount = json.data.filter(d => d.is_high_risk).length;
             setStats({ total: json.data.length, highRisk: highRiskCount });
           }
        }
      } catch (err) {
        console.error("API not available...", err);
      }
    };
    
    fetchData();
    // Refresh every 4 seconds for real-time vibe
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, []);

  const runOptimizer = async () => {
    setIsOptimizing(true);
    setAiMetrics(null);
    try {
      const res = await fetch("http://localhost:8000/optimize");
      if (res.ok) {
        const json = await res.json();
        if (json.status === "success" && json.route && json.route.length > 0) {
          // Scale coordinates identically to our debris points
          const scaledRoute = json.route.map(pos => [
            pos[0] * SCALE,
            pos[2] * SCALE,
            -pos[1] * SCALE
          ]);
          setCleanupRoute(scaledRoute);
          setAiMetrics(json.metrics);
          setShowAnalytics(true);
        }
      }
    } catch(err) {
      console.error(err);
    }
    setIsOptimizing(false);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#020205' }}>
      
      {/* 3D WebGL Context */}
      <Canvas camera={{ position: [0, 2.5, 9], fov: 45 }}>
        <color attach="background" args={['#010103']} />
        
        {/* Cinematic Directional Lighting for accurate Day/Night cycle */}
        <ambientLight intensity={0.1} />
        <directionalLight position={[-15, 5, 5]} intensity={3.5} color="#ffffff" />
        
        <Stars radius={150} depth={50} count={6000} factor={4} saturation={0} fade speed={appState === 'warping' ? 10 : 1} />
        
        <CameraRig appState={appState} setAppState={setAppState} />
        <WormholeTunnel appState={appState} />

        <Suspense fallback={<mesh><sphereGeometry args={[2, 32, 32]} /><meshBasicMaterial wireframe color="#0044ff" /></mesh>}>
           <Earth />
        </Suspense>
        
        {hoveredItem && <HoverOrbit item={hoveredItem} />}
        <DebrisCloud data={debrisData} setHoveredItem={setHoveredItem} />
        
        {/* Draw the TSP Algorithm Cleanup Route! */}
        {cleanupRoute && (
          <Line 
            points={cleanupRoute} 
            color="#ffea00" 
            lineWidth={2.5} 
            transparent 
            opacity={0.8}
            dashed={true}
            dashSize={0.2}
            dashScale={0.5}
          />
        )}
        
        {appState === 'dashboard' && (
            <OrbitControls 
              enablePan={false} 
              maxDistance={25} minDistance={3} 
              autoRotate autoRotateSpeed={0.5} 
            />
        )}
      </Canvas>

      <div className="ui-container" style={{ pointerEvents: appState === 'dashboard' ? 'none' : 'auto' }}>
        
        {/* Intro Hyperspace Landing Screen */}
        {appState !== 'dashboard' && (
          <div style={{ position:'absolute', top:0, left:0, width:'100vw', height:'100vh', display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center', background: 'rgba(0,0,0,0.6)', zIndex: 100, opacity: appState === 'intro' ? 1 : 0, transition: 'opacity 1s ease-out' }}>
            <h1 style={{ fontSize: '4.5rem', color: '#fff', textShadow: '0 0 30px #00aaff', margin: 0 }}>SPACE DEBRIS AI</h1>
            <p style={{ color: '#00ffcc', letterSpacing: '6px', marginBottom: '50px', fontWeight: 'bold' }}>NEURAL ORBITAL TRACKING ENGINE</p>
            <button 
              style={{ padding: '16px 45px', fontSize: '1.2rem', background: 'transparent', color: '#00aaff', border: '2px solid #00aaff', cursor: 'pointer', borderRadius: '4px', boxShadow: '0 0 15px rgba(0, 170, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 'bold', transition: 'all 0.3s ease' }}
              onClick={() => setAppState('warping')}
              onMouseOver={(e) => { e.target.style.background = 'rgba(0,170,255,0.2)'; e.target.style.boxShadow = '0 0 30px rgba(0, 170, 255, 0.8)'; }}
              onMouseOut={(e) => { e.target.style.background = 'transparent'; e.target.style.boxShadow = '0 0 15px rgba(0, 170, 255, 0.4)'; }}
            >
              Initialize Datalink
            </button>
          </div>
        )}

        <div className="glass-sidebar" style={{ 
            opacity: appState === 'dashboard' ? 1 : 0, 
            transform: appState === 'dashboard' ? 'translateX(0)' : 'translateX(100px)',
            transition: 'all 1.5s ease-out',
            pointerEvents: appState === 'dashboard' ? 'auto' : 'none'
        }}>
          
          <div>
            <h1>Debris Radar</h1>
            <p style={{ margin: 0, color: '#A2B2EE', fontSize: '0.85rem', marginTop: "5px" }}>
              Kaggle ML Engine + Live SGP4 Physics
            </p>
          </div>

          <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '4px 0' }} />

          <div className="stat-box">
            <span style={{color: '#ddd'}}>Objects Tracked</span>
            <span className="stat-value">{stats.total}</span>
          </div>

          <div className="stat-box danger">
            <span style={{color: '#fbb'}}>High Risk Targets</span>
            <span className="stat-value danger-text">{stats.highRisk}</span>
          </div>
          
          <div className="stat-box">
            <span style={{color: '#ddd'}}>ML Engine</span>
            <span className="stat-value" style={{color: '#00ff77', textShadow: "0 0 10px rgba(0,255,100,0.5)"}}>ONLINE</span>
          </div>

          <div className="legend-container">
            <div className="legend-item">
              <span className="legend-dot" style={{background: '#00ff77', boxShadow: '0 0 8px #00ff77'}}></span>
              <span>Active Satellites</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{background: '#00ffff', boxShadow: '0 0 8px #00ffff'}}></span>
              <span>Safe Debris</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{background: '#ff1100', boxShadow: '0 0 8px #ff1100'}}></span>
              <span>High Risk Debris (Targets)</span>
            </div>
          </div>
          
          {aiMetrics && (
            <div className="stat-box" style={{ flexDirection: 'column', alignItems: 'flex-start', background: 'rgba(0, 255, 100, 0.1)', borderColor: 'rgba(0, 255, 100, 0.3)' }}>
              <span style={{color: '#00ff77', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px'}}>AI Objective Complete</span>
              <div style={{fontSize: '0.85rem', color: '#ccc', width: '100%', display: 'flex', justifyContent: 'space-between'}}>Targets: <span style={{color: '#fff'}}>{aiMetrics?.targets_neutralized || 0} Critical</span></div>
              <div style={{fontSize: '0.85rem', color: '#ccc', width: '100%', display: 'flex', justifyContent: 'space-between'}}>Routing: <span style={{color: '#fff'}}>{aiMetrics?.optimized_distance_km?.toLocaleString()} km</span></div>
              <div style={{fontSize: '0.85rem', color: '#00ff77', width: '100%', display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontWeight: 'bold'}}>Δv Fuel Saved: <span style={{color: '#00ff77'}}>{aiMetrics?.fuel_saved_km?.toLocaleString()} km</span></div>
            </div>
          )}

          {hoveredItem && (
            <div className="stat-box" style={{ flexDirection: 'column', alignItems: 'flex-start', background: 'rgba(0, 150, 255, 0.1)', borderColor: 'rgba(0, 150, 255, 0.3)' }}>
              <span style={{color: '#00aaff', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px'}}>Target Inspector</span>
              <div style={{fontSize: '0.85rem', color: '#ccc', width: '100%', display: 'flex', justifyContent: 'space-between'}}>ID: <span style={{color: '#fff'}}>{hoveredItem.name}</span></div>
              <div style={{fontSize: '0.85rem', color: '#ccc', width: '100%', display: 'flex', justifyContent: 'space-between'}}>Type: <span style={{color: '#fff', textTransform: 'capitalize'}}>{hoveredItem.type}</span></div>
              <div style={{fontSize: '0.85rem', color: '#ccc', width: '100%', display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontWeight: 'bold'}}>Threat Level: <span style={{color: hoveredItem.is_high_risk ? '#ff1100' : '#00ffff'}}>{(hoveredItem.risk_score * 100).toFixed(1)}%</span></div>
            </div>
          )}

          <button 
            className="btn-optimize" 
            onClick={runOptimizer} 
            disabled={isOptimizing}
            style={{ opacity: isOptimizing ? 0.6 : 1 }}
          >
            {isOptimizing ? "Calculating Route..." : "Run Cleanup Optimizer"}
          </button>
          
        </div>
      </div>
      
      {/* Analytics Graphical Sub-Page Overlay */}
      {showAnalytics && aiMetrics && (
        <div className="analytics-overlay">
          <div className="analytics-modal">
             <div className="analytics-modal-header">
               <h2>Mission Analytics</h2>
               <button className="btn-close" onClick={() => setShowAnalytics(false)}>Close Analysis</button>
             </div>
             <div className="analytics-content">
               
               <div style={{ display: 'flex', gap: '20px', marginBottom: '10px' }}>
                 <div className="stat-box" style={{ flex: 1, flexDirection: 'column' }}>
                    <span style={{color: '#aaa', fontSize:'0.8rem', textTransform:'uppercase'}}>Targets Cleared</span>
                    <span className="stat-value">{aiMetrics.targets_neutralized}</span>
                 </div>
                 <div className="stat-box" style={{ flex: 1, flexDirection: 'column' }}>
                    <span style={{color: '#aaa', fontSize:'0.8rem', textTransform:'uppercase'}}>Optimized Distance</span>
                    <span className="stat-value">{aiMetrics.optimized_distance_km.toLocaleString()} km</span>
                 </div>
                 <div className="stat-box" style={{ flex: 1, flexDirection: 'column', background: 'rgba(0,255,100,0.1)' }}>
                    <span style={{color: '#00ff77', fontSize:'0.8rem', textTransform:'uppercase'}}>Total Fuel Saved</span>
                    <span className="stat-value" style={{color: '#00ff77'}}>{aiMetrics.fuel_saved_km.toLocaleString()} units</span>
                 </div>
               </div>

               <div>
                 <h3 style={{color:'#00ffff'}}>Genetic Algorithm Convergence Analysis</h3>
                 <p style={{color:'#aaa', fontSize:'0.9rem', marginBottom:'20px'}}>This graph plots the fuel-cost mathematically plummeting as the DEAP Genetic Optimizer evaluates and mutates routes across 40 generations.</p>
               </div>

               <div style={{ width: '100%', height: '300px' }}>
                 <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={aiMetrics.convergence_history.map((val, idx) => ({ generation: idx, fuel: val }))}>
                     <defs>
                        <linearGradient id="colorFuel" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#00f0ff" stopOpacity={0}/>
                        </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                     <XAxis dataKey="generation" stroke="#888" tick={{fill: '#888'}} />
                     <YAxis stroke="#888" tick={{fill: '#888'}} domain={['auto', 'auto']} />
                     <Tooltip 
                       contentStyle={{backgroundColor:'rgba(10,15,30,0.95)', border:'1px solid rgba(0,240,255,0.4)', borderRadius:'8px', color:'#fff'}}
                       itemStyle={{color: '#00f0ff'}}
                     />
                     <Area type="monotone" dataKey="fuel" stroke="#00f0ff" strokeWidth={3} fillOpacity={1} fill="url(#colorFuel)" />
                   </AreaChart>
                 </ResponsiveContainer>
               </div>
               
             </div>
          </div>
        </div>
      )}
      
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';

// Main App component for the AuraSense Dashboard
function App() {
  // State to hold the Firebase Auth and Firestore instances
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  // State to hold the current user's ID
  const [userId, setUserId] = useState(null);
  // State to hold the latest sensor reading
  const [latestReading, setLatestReading] = useState(null);
  // State to hold all sensor readings for display (e.g., last 10)
  const [sensorReadings, setSensorReadings] = useState([]);
  // State for any error messages
  const [error, setError] = useState(null);
  // State for loading indicator
  const [isLoading, setIsLoading] = useState(true);

  // --- Firebase Initialization and Authentication ---
  useEffect(() => {
    try {
      // MANDATORY: Access global Firebase config variables injected by the Canvas environment
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
      const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

      if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
        setError('Firebase configuration not found. Please ensure __firebase_config is set.');
        setIsLoading(false);
        console.error('Firebase configuration is missing or empty.');
        return;
      }

      // Initialize Firebase App
      const app = initializeApp(firebaseConfig);
      // Initialize Firestore and Auth services
      const firestoreDb = getFirestore(app);
      const firebaseAuth = getAuth(app);

      setDb(firestoreDb);
      setAuth(firebaseAuth);

      // Listen for authentication state changes
      const unsubscribeAuth = onAuthStateChanged(firebaseAuth, async (user) => {
        if (user) {
          // User is signed in. Get their UID.
          setUserId(user.uid);
          console.log('User signed in with UID:', user.uid);
          setIsLoading(false);
        } else {
          // User is signed out. Attempt anonymous sign-in or use custom token.
          try {
            if (initialAuthToken) {
              await signInWithCustomToken(firebaseAuth, initialAuthToken);
              console.log('Signed in with custom token.');
            } else {
              await signInAnonymously(firebaseAuth);
              console.log('Signed in anonymously.');
            }
          } catch (authError) {
            setError(`Authentication failed: ${authError.message}`);
            setIsLoading(false);
            console.error('Authentication error:', authError);
          }
        }
      });

      // Cleanup auth listener on component unmount
      return () => unsubscribeAuth();

    } catch (err) {
      setError(`Failed to initialize Firebase: ${err.message}`);
      setIsLoading(false);
      console.error('Firebase initialization error:', err);
    }
  }, []); // Run once on component mount

  // --- Firestore Data Fetching ---
  useEffect(() => {
    // Only attempt to fetch data if Firestore DB and user ID are available
    if (db && userId) {
      setError(null); // Clear previous errors

      // Define the path for public data: /artifacts/{appId}/public/data/sensorReadings
      // Note: We use a placeholder for appId as it's not strictly needed for the collection path when public.
      // However, it's good practice to demonstrate how it would be used if dynamically building paths.
      // For this example, we assume `sensorReadings` is a public top-level collection for simplicity
      // and to demonstrate real-time data flow quickly.
      // If we were using the recommended path /artifacts/{appId}/public/data/sensorReadings
      // const sensorReadingsCollectionRef = collection(db, `artifacts/${__app_id}/public/data/sensorReadings`);
      // For this simple example, we use a top-level public collection as per many Firebase tutorials.
      const sensorReadingsCollectionRef = collection(db, 'sensorReadings');

      // Create a query to get the latest 10 readings, ordered by timestamp
      const q = query(sensorReadingsCollectionRef, orderBy('timestamp', 'desc'), limit(10));

      // Set up a real-time listener using onSnapshot
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const readings = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          readings.push({
            id: doc.id,
            ...data,
            // Convert Firebase Timestamp to JS Date object if it exists
            timestamp: data.timestamp ? data.timestamp.toDate() : null
          });
        });
        setSensorReadings(readings);
        // The latest reading will be the first one in the sorted array
        if (readings.length > 0) {
          setLatestReading(readings[0]);
        }
        setIsLoading(false);
      }, (firestoreError) => {
        setError(`Failed to fetch sensor data: ${firestoreError.message}`);
        setIsLoading(false);
        console.error('Firestore data fetch error:', firestoreError);
      });

      // Cleanup listener on component unmount or when db/userId changes
      return () => unsubscribe();
    }
  }, [db, userId]); // Re-run when db or userId changes

  // --- Render UI ---
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <p className="text-xl">Loading AuraSense Dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-red-900 text-white p-4">
        <p className="text-2xl font-bold mb-4">Error:</p>
        <p className="text-lg text-center">{error}</p>
        <p className="text-sm mt-4">Please check your Firebase configuration and network connection.</p>
        {userId && <p className="text-sm mt-2">Authenticated User ID: {userId}</p>}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 md:p-10 font-inter">
      <div className="max-w-4xl mx-auto">
        {/* Header Section */}
        <header className="mb-8 text-center">
          <h1 className="text-5xl font-extrabold text-blue-400 mb-2 rounded-lg p-2">AuraSense Dashboard</h1>
          {userId && (
            <p className="text-gray-400 text-sm md:text-base rounded-md p-1">
              Connected as: <span className="font-mono bg-gray-800 rounded px-2 py-1">{userId}</span>
            </p>
          )}
        </header>

        {/* Latest Reading Section */}
        <section className="mb-10 p-6 bg-gray-800 rounded-xl shadow-lg border border-gray-700">
          <h2 className="text-3xl font-bold text-blue-300 mb-4 text-center">Latest Sensor Reading</h2>
          {latestReading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xl">
              <div className="p-4 bg-gray-700 rounded-lg flex items-center justify-between shadow-inner">
                <span className="font-semibold text-gray-300">Temperature:</span>
                <span className="text-emerald-400 font-bold text-3xl">{latestReading.temperature}°C</span>
              </div>
              <div className="p-4 bg-gray-700 rounded-lg flex items-center justify-between shadow-inner">
                <span className="font-semibold text-gray-300">Humidity:</span>
                <span className="text-purple-400 font-bold text-3xl">{latestReading.humidity}%</span>
              </div>
              <div className="col-span-1 md:col-span-2 p-4 bg-gray-700 rounded-lg text-center shadow-inner">
                <span className="font-semibold text-gray-300">Last Updated:</span>{' '}
                <span className="text-gray-200">
                  {latestReading.timestamp ? latestReading.timestamp.toLocaleString() : 'N/A'}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-center text-gray-400 text-lg">No sensor data available yet. Please add some data to Firestore!</p>
          )}
        </section>

        {/* Recent Readings Table (for now, later can be a graph) */}
        <section className="p-6 bg-gray-800 rounded-xl shadow-lg border border-gray-700">
          <h2 className="text-3xl font-bold text-blue-300 mb-4 text-center">Recent Sensor Readings</h2>
          {sensorReadings.length > 0 ? (
            <div className="overflow-x-auto rounded-lg">
              <table className="min-w-full bg-gray-700 rounded-lg overflow-hidden">
                <thead className="bg-gray-600 text-gray-200">
                  <tr>
                    <th className="py-3 px-4 text-left font-semibold">Timestamp</th>
                    <th className="py-3 px-4 text-left font-semibold">Temperature</th>
                    <th className="py-3 px-4 text-left font-semibold">Humidity</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  {sensorReadings.map((reading) => (
                    <tr key={reading.id} className="border-t border-gray-600 hover:bg-gray-600 transition-colors duration-200">
                      <td className="py-3 px-4">
                        {reading.timestamp ? reading.timestamp.toLocaleString() : 'N/A'}
                      </td>
                      <td className="py-3 px-4">{reading.temperature}°C</td>
                      <td className="py-3 px-4">{reading.humidity}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-400 text-lg">No recent readings to display.</p>
          )}
        </section>
      </div>
    </div>
  );
}

export default App;

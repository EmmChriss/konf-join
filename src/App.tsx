import React, { useEffect, useMemo, useRef, useState } from 'react'

import { FirebaseOptions, initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, EmailAuthProvider, Auth, setPersistence, browserLocalPersistence } from "firebase/auth"
import { connectFirestoreEmulator, getFirestore, onSnapshot, collection, query,  Query, QuerySnapshot, FirestoreError, orderBy, Timestamp, FirestoreDataConverter, WithFieldValue, QueryDocumentSnapshot, DocumentData, SnapshotOptions,  doc, getDoc, updateDoc, setDoc, addDoc } from 'firebase/firestore'
import { Card, Stack, Button, Container, Box, TextField } from '@mui/material'
import 'firebaseui/dist/firebaseui.css'

const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyBKfd6j3ET9UnO78zoanLzLebZj9NKuYMk",
  authDomain: "konf-join.firebaseapp.com",
  projectId: "konf-join",
  storageBucket: "konf-join.appspot.com",
  messagingSenderId: "157233284590",
  appId: "1:157233284590:web:bdeedd97af57bdd88ebaff"
}

const app = initializeApp(firebaseConfig)
// const auth = getAuth(app)
const db = getFirestore(app)

// if (window.location.hostname === "localhost") {
//   console.log("localhost detected!")
//   connectAuthEmulator(auth, 'http://localhost:4401')
//   connectFirestoreEmulator(db, 'localhost', 4402)
// }

// function App() {
//   const [loggedIn, setLoggedIn] = useState(auth.currentUser !== null)
//   const firebaseUIRef = useRef<HTMLDivElement>(null)

//   // show login ui if not logged in yet
//   const onceCounter = useRef(false)
//   const showLoginUi = async () => {
//     if (firebaseUIRef.current === null || onceCounter.current)
//       return
//     onceCounter.current = true

//     await setPersistence(auth, browserLocalPersistence)

//     var ui = new AuthUI.AuthUI(auth, firebaseConfig.appId);
//     ui.start(firebaseUIRef.current, {
//       signInOptions: [
//         EmailAuthProvider.PROVIDER_ID
//       ],
//       callbacks: {
//         signInSuccessWithAuthResult: () => {
//           setLoggedIn(true)
//           return false
//         }
//       }
//     })
//   }
//   useEffect(() => void showLoginUi(), [firebaseUIRef.current])
  
//   return (<>
//     {loggedIn && <LoggedInApp /> ||
//       <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-around", height: "100%" }} >
//         <div>
//           <div ref={firebaseUIRef} />
//         </div>
//       </div>}
//   </>);
// }

function useLiveList<T>(query: Query<T>) {
  const [items, setItems] = useState<T[]>([])
  const [error, setError] = useState<string>()
  
  useEffect(() => {
    const onNext = (snapshot: QuerySnapshot<T>) => {
      const updatedItems = snapshot.docs.map(doc => doc.data())
      setItems(updatedItems)
    }

    const onError = (error: FirestoreError) => {
      setError(error.message)
    }
    
    const unsubscribe = onSnapshot(query, onNext, onError)
    return unsubscribe;
  }, [setItems]);

  return { items, error }
}

interface Activity {
  id: string
  time: Timestamp
}

const activityConverter: FirestoreDataConverter<Activity | undefined> =  {
  toFirestore: (model: WithFieldValue<Activity>) => model,
  fromFirestore: (snapshot: QueryDocumentSnapshot<DocumentData>, options?: SnapshotOptions) => {
    const id = snapshot.id
    const d = snapshot.data()
    const time = d["time"]

    if (!(time instanceof Timestamp))
      return

    return { id, time }
  }
}


interface Event {
  id: string,
  participants: Record<string, true>,
  limit: number,

  name: string,
  author: string,
  description: string,
}

const eventConverter: FirestoreDataConverter<Event | undefined> = {
  toFirestore: (model: WithFieldValue<Event>) => model,
  fromFirestore: (snapshot: QueryDocumentSnapshot<DocumentData>, options?: SnapshotOptions) => {
    const id = snapshot.id
    const d = snapshot.data()
    const name = d["name"]
    const author = d["author"]
    const description = d["description"]
    const participants = d["participants"]
    const limit = d["limit"]

    if (typeof(name) !== 'string' || typeof(author) !== 'string' || typeof(description) !== 'string' || typeof(participants) !== 'object' || typeof(limit) !== 'number')
      return

    return { id, name, author, description, participants, limit }
  }
}

const activitiesRef = collection(db, 'activity') 
const activitiesQuery = query(activitiesRef, orderBy('time')).withConverter(activityConverter)

const eventsRef = (activityId: string) => collection(db, 'activity', activityId, 'event')
const eventsQuery = (activityId: string) => query(eventsRef(activityId)).withConverter(eventConverter)

interface User {
  email: string,
  name: string
}

let user: User = {
  email: "",
  name: ""
}

function App() {
  const [fixed, setFixed] = useState(false)
  const [emailInvalid, setEmailInvalid] = useState(false)
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")

  const handleEmailOnChange = (el: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    let re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

    setEmail(el.target.value)
    setEmailInvalid(!re.test(el.target.value))
  }

  const handleFix = async () => {
    if (email == "" || name == "" || emailInvalid)
      return

    user = { name, email }

    // save user
    const docPath = collection(db, "users")
    const document = { name, email }

    await addDoc(docPath, document)
    
    setFixed(true)
  }

  const activities = useLiveList(activitiesQuery)
  const filteredActivities = activities.items.filter(a => a).map(a => a!!)

  return (
    <Container>
      <img src={process.env.PUBLIC_URL + '/logo.png'} style={{ width: "100%" }} />
      <Stack spacing={2} direction="column">
        {(fixed) ? (
          filteredActivities.map((activity: Activity) => 
              <ActivityView 
                activity={activity}
                />
          )
        ) : (
          <Card style={{ padding: "8px" }}>
            <Stack spacing={2} direction="column">
              <TextField label="Email" type="email" variant="standard" disabled={fixed} value={email} error={emailInvalid} onChange={handleEmailOnChange} />
              <TextField label="Név" type="text" variant="standard" disabled={fixed} value={name} onChange={(el) => setName(el.target.value)} />
              <Button variant="contained" disabled={fixed} onClick={handleFix}>Tovább</Button>
            </Stack>
          </Card>
        )}
      </Stack>
    </Container>
  )
}

function ActivityView({
  activity
}: {
  activity: Activity
}) {
  const events = useLiveList(eventsQuery(activity.id))
  const filteredEvents = events.items.filter(event => event).map(event => event!!)

  const joinEvent = async (activity: Activity, event: Event) => {
    // remove all previous participations for user
    await Promise.all(filteredEvents.map(e => leaveEvent(activity, e)))
  
    const docRef = doc(db, "activity", activity.id, 'event', event.id)
    const snapshot = await getDoc(docRef)

    const participants: Record<string, true> = snapshot.get("participants") ?? {}
    participants[user.email] = true

    const docData = { participants }
    await updateDoc(docRef, docData)
  }

  const leaveEvent = async (activity: Activity, event: Event) => {
    const docRef = doc(db, "activity", activity.id, 'event', event.id)
    const snapshot = await getDoc(docRef)

    const participants: Record<string, true> = snapshot.get("participants") ?? {}
    delete participants[user.email]

    const docData = { participants }
    await updateDoc(docRef, docData)
  }

  return (
    <Card style={{ padding: "8px" }} >
      <span style={{ fontSize: "24px", lineHeight: "1.5em" }}>{activity.time.toDate().toDateString()}</span>
      <Stack spacing={2} direction="column">
        {filteredEvents.map(event => 
          <EventView
            activity={activity}
            event={event}
            joinEvent={joinEvent}
            leaveEvent={leaveEvent}
            />
        )}
      </Stack>
    </Card>
  )
}

function EventView({
  activity,
  event,
  joinEvent,
  leaveEvent
}: {
  activity: Activity,
  event: Event,
  joinEvent: (a: Activity, e: Event) => void,
  leaveEvent: (a: Activity, e: Event) => void
}) {
  const participating = user.email in event.participants
  const current = Object.keys(event.participants).length
  const limit = event.limit
  const full = Object.keys(event.participants).length == event.limit
  
  return (
    <Card style={{ padding: "8px" }}>
      <Stack direction="row" style={{ justifyContent: "space-between" }}>
        <Stack direction="column" style={{ justifyContent: "space-around" }}>{event.name}</Stack>
        <Box style={{ order: 1 }}>
          <span>{current} / {limit}</span>
          {participating ?
            (<Button onClick={() => leaveEvent(activity, event)}>{"Leave"}</Button>) :
            (<Button onClick={() => joinEvent(activity, event)} disabled={full}>{"Join"}</Button>)
          }
        </Box>
      </Stack>
    </Card>
  )
}

export default App;

import React, { useEffect, useMemo, useRef, useState } from 'react'

import { FirebaseOptions, initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, EmailAuthProvider, Auth, setPersistence, browserLocalPersistence } from "firebase/auth"
import { connectFirestoreEmulator, getFirestore, onSnapshot, collection, query,  Query, QuerySnapshot, FirestoreError, orderBy, Timestamp, FirestoreDataConverter, WithFieldValue, QueryDocumentSnapshot, DocumentData, SnapshotOptions,  doc, getDoc, updateDoc, setDoc, addDoc } from 'firebase/firestore'
import { Card, Stack, Button, Container, Box, TextField, Paper, Divider, Checkbox, FormControlLabel, Switch } from '@mui/material'
import 'firebaseui/dist/firebaseui.css'
import { useCookies } from 'react-cookie'

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
}

const eventConverter: FirestoreDataConverter<Event | undefined> = {
  toFirestore: (model: WithFieldValue<Event>) => model,
  fromFirestore: (snapshot: QueryDocumentSnapshot<DocumentData>, options?: SnapshotOptions) => {
    const id = snapshot.id
    const d = snapshot.data()
    const name = d["name"]
    const author = d["author"]
    const participants = d["participants"]
    const limit = d["limit"]

    if (typeof(name) !== 'string' || typeof(author) !== 'string' || typeof(participants) !== 'object' || typeof(limit) !== 'number')
      return

    return { id, name, author, participants, limit }
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
  const [privacy, setPrivacy] = useState(false)
  const [cookies, setCookie, removeCookie] = useCookies(['accepted-policy'])

  const handleEmailOnChange = (el: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    let re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

    setEmail(el.target.value)
    setEmailInvalid(!re.test(el.target.value))
  }

  const handleFix = async () => {
    if (email == "" || name == "" || emailInvalid || !privacy)
      return

    user = { name, email }

    // save user
    const colPath = collection(db, "users")
    const document = { name, email }

    await addDoc(colPath, document)
    
    setFixed(true)
  }

  const activities = useLiveList(activitiesQuery)
  const filteredActivities = activities.items.filter(a => a).map(a => a!!)

  return (
    <>
    <Container style={{ height: "100%" }}>
      {fixed && <img src={process.env.PUBLIC_URL + '/logo.jpg'} style={{ width: "100%" }} />}
      <Stack spacing={2} direction="column" style={{ minHeight: "100%", paddingBottom: "30%" }}>
        {(fixed) ? (
          filteredActivities.map((activity: Activity) => 
              <ActivityView 
                activity={activity}
                />
          )
        ) : (
          <Card style={{ padding: "2em" }}>
            <Stack spacing={2} direction="column" style={{ textAlign: "center" }}>
              <span style={{ fontSize: "2em" }}>Bejelentkezés</span>
              <TextField label="Email" type="email" variant="standard" disabled={fixed} value={email} error={emailInvalid} onChange={handleEmailOnChange} />
              <TextField label="Név" type="text" variant="standard" disabled={fixed} value={name} onChange={(el) => setName(el.target.value)} />
              <Stack direction="row" style={{ opacity: 0.7, fontSize: "0.8em", alignItems: "center" }}>
                <Checkbox checked={privacy} onChange={el => setPrivacy(el.target.checked)} color="primary" />
                Beleegyezek adataim kezelésébe a lenti feltételek szerint
              </Stack>
              <Button variant="contained" disabled={fixed} onClick={handleFix}>Tovább</Button>
              <Divider/>
              <span style={{ opacity: 0.7, fontSize: "0.8em", textAlign: "start" }}>
                A fenti "Tovább" gombra kattintva hozzájárul a személyes adatai adatkezelő általi kezeléséhez,
                rendszerezéséhez, tárolásához, felhasználásához, lekérdezéséhez, továbbításához, zárolásához,
                törléséhez, megsemmisítéséhez, az adat további felhasználásának megakadályozásához.
                <br/><br/>
                A hozzájárulását bármikor önkéntesen visszavonhatja, azonban a hozzájárulás visszavonása
                nem érinti a visszavonás előtti adatkezelés jogszerűségét. Hiányos, ellentmondásos vagy
                értelmezhetetlen jelölést az Adatkezelőnek a hozzájárulás megtagadásaként kell értelmeznie.
              </span>
            </Stack>
          </Card>
        )}
      </Stack>
    </Container>

    {cookies["accepted-policy"] ? null : (
        <Paper style={{ position: "fixed", minWidth: "100%", left: 0, bottom: 0 }}>
        <Container>
          <Stack direction="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ padding: "1em" }}>A weboldalon cookiekat használunk. </span>
              <Stack direction="column">
                <Button size="small" onClick={() => setCookie("accepted-policy", true)} data-cookie-set="accept" aria-label="Megértettem!">Megértettem!</Button>
              </Stack>
          </Stack>
        </Container>
        </Paper>
      )
    }
    </>
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

  const date = activity.time.toDate()
  const hours = (date.getHours() < 10) ? `0${date.getHours()}` : date.getHours().toString()
  const minutes = (date.getMinutes() < 10) ? `0${date.getMinutes()}` : date.getMinutes().toString()
  return (
    <Card style={{ padding: "8px" }} >
      <span style={{ fontSize: "24px", lineHeight: "1.5em" }}>{date.toDateString()} {hours}:{minutes}</span>
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
        <Stack direction="column" style={{ justifyContent: "space-around" }}>{event.author}: {event.name}</Stack>
        <Box style={{ order: 1 }}>
          <span>{current} / {limit}</span>
          {participating ?
            (<Button onClick={() => leaveEvent(activity, event)}>{"Visszamondás"}</Button>) :
            (<Button onClick={() => joinEvent(activity, event)} disabled={full}>{"Csatlakozás"}</Button>)
          }
        </Box>
      </Stack>
    </Card>
  )
}

export default App;

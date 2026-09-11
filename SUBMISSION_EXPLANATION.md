Honestly the websocket part itself was the easy bit, npm install socket.io and you're basically there. What took actual thinking was making sure the live feed couldn't leak stuff — a socket connection is technically a second way into your data, and it's easy to lock down every REST route carefully and then forget the socket layer entirely, so a developer ends up able to just sit there and watch events they were never supposed to see even with an airtight API.

What I landed on was rooms. Every socket joins a room for its own user id on connect, admins also join an admin-wide room, and opening a project joins that project's room for as long as you're looking at it. When a task changes, one place decides who hears about it and sends the event to exactly the right rooms: the project, admin, whoever manages that project, and whoever it's assigned to if anyone. So the permission rules aren't maintained twice — it's the same manager/assignee checks the REST routes use, just applied at emit time instead of query time.

Catching up after being offline works the same way, just a normal DB read instead of a live push, so there's no separate cache that could accidentally show someone something they shouldn't see.

If I revisited this, I'd log denied access attempts instead of just returning a 403 and moving on — usually the first thing you want when someone says "I can't see my project."

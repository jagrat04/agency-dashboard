Honestly the websocket setup itself wasn't the hard part, socket.io does most of the heavy lifting there. The part I actually had to sit and think about was making sure the live feed didn't leak anything, because a socket connection is basically a second door into your data. You can lock down every REST route perfectly and still forget about the socket side, and then a developer just watches the feed and sees stuff they were never supposed to see, even though your API looks airtight on paper.

The way I ended up handling it was with rooms. Every socket joins a room for its own user on connect, admins also get dropped into an admin-wide room, and opening a project joins that project's room for as long as you're on that page. When a task changes, one spot decides who gets told and only fires to the rooms that should hear it — project, admin, whoever manages it, whoever it's assigned to. So I'm not rewriting the same permission logic twice, it's the same manager/assignee checks as the REST side, just running at emit time instead of query time.

Missed events on reconnect work the same way, pulled from the DB instead of pushed live, so there's no separate cache that could show someone something they shouldn't see.

Thing I'd probably change: a 403 right now just vanishes with no trace, and that's usually the first thing worth logging when someone says they can't see a project.

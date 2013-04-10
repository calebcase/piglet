piglet
======

Your friendly little restful time series service.

The Proposal
------------

- /:id/:type
  - POST
    - Request => Data is a JSON number. Time will be the current time on the server.

- /:id/:type/:start
  - GET
    - Response =>
      Range is from the given start till current time.

      ?format=json: key is time, value is a number.
      ?format=<jpeg|png|svg>: Rendered graph of data.
    - Parameters =>
      format=<json|jpeg|png|svg> (defaults to json)
      height=<px> (defaults to 480)
      width=<px> (defaults to 640)
      slice=<timespec> (see below) (defaults to 1 minute)
      aggregate=<none|count|sum|mean|median|max|min|Q1|Q2|Q3> (defaults to mean)
      merge=<types> (defaults to none)
  - POST
    - Request => Data is a JSON number. Time is set to the value in the url.

- /:id/:type/:start/:stop
  - Same as above but:
    Range is from the given start to stop time.

Alternation in the URL can be used to select multiple ids and types at a time:

```
/vm/{cpu,ram,io}/1365472770/1365473070
```

Time can be in a convient format like that accepted by 'at' (aka timespec):

```
/vm/{cpu,ram,io}/last monday/last wednesday
/vm/{cpu,ram,io}/last month
```

All of a given type can be selected with '*':

```
/vm/*/yesterday
```

With a limited form of globbing we could also permit matches on a subset of types:

```
vm/net.*,io.sda{1,2}/last week
```

That would permit a very nice 'subtype' style where you could have several types for network or io, but also easily select all of them. If merge is specified, then the subtypes under the supplied type (e.g. merge=net) would be recombined into a pseudo-type (e.g. All of the net.* values would be seen as just generic 'net' values).

If a slice is specified, the data is aggregated into fixed size chunks. The midpoint is the time reported for the slice. The aggregation method specifies how the data in a given slice should be combined into a single datapoint.

Responses with JSON will always be canonical/rooted:

```json
{
  "vm": {
    "cpu": {
      "1365472770": 0.20
      ...
    },
    "ram": {...}
    "io": {...}
  }
}
```

In this way it is consistent for the user to parse responses where they have requested multiple series.

```
/vm{1,2,3}/cpu,ram/yesterday?slice=10m
```

```json
{
  "vm1": {
    "cpu": {
      "1365472770": 0.20
      ...
    },
    "ram": {...}
  },
  "vm2": {...},
  "vm3": {...}
}
```

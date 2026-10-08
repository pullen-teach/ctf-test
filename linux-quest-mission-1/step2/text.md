# Mission 2: Make your moves

```
cd ~/mission2
cat README.txt
```{{exec}}

Moving around is the first real skill on the command line:

| Command | What it does |
|---|---|
| `pwd` | where am I? |
| `ls` | what is in this folder? |
| `cd NAME` | move into a folder |
| `cd ..` | go back up one level |
| `cd ~` | go home |

A flag is hidden at the end of a trail inside `town/`. Every folder has a `note.txt` that tells
you where to go next. Some turns are dead ends.

At the end the flag is there, but **hidden**: files whose names start with a dot do not show up
in plain `ls`. One hidden file is a decoy.

**Useful commands:** `pwd`, `ls`, `cd`, `cat`. Use `--help` to discover what they can do.

<br>

<details><summary>Hint</summary>

Lost? `pwd` shows where you are and `cd ..` goes back up. At the end of the trail, read the
help for `ls` and look for an option that also shows names starting with `.`:

```
ls --help
```

The full manual page has even more: `man ls` (press `q` to quit).

</details>

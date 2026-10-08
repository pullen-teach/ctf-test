# Mission 3: Search party

```
cd ~/mission3
cat README.txt
wc -l access.log
```{{exec}}

`access.log` has 40,000 lines. One intruder logged in exactly once.
Their **token** on that line is the flag.

Scrolling would take all day.

<br>

<details><summary>Hint</summary>

`grep word file` prints only the lines that contain `word`. The username is in the README.

</details>

<details><summary>Solution</summary>

```
grep <username> access.log
```

The flag is the text after `token=`.

</details>

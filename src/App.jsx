import {
    useState,
    useReducer,
    useEffect,
    useLayoutEffect,
    useContext,
    createContext,
    useRef
} from "react";
import axios from "axios";

const appName = "S'Post ";
const API_BASE_URL = "https://s-post-server.vercel.app/api";

const endpoints = {
    makePost: `${API_BASE_URL}/post/make`,
    likePost: `${API_BASE_URL}/post/like`,
    loadPost: `${API_BASE_URL}/post/load`,
    homePage: API_BASE_URL.replace("api", ""),
    copyPost: `${API_BASE_URL}/post/single`
};

const timerDelay = 200; // ms
const blurDislikes = 100;
const maxPostContentLength = 5000;
const maxAuthorName = 25;
const isLargeScreen = innerWidth >= 500 && innerHeight >= 700;

const scrollLap = 50;
const scrolledEnd = ele => {
    if (!ele) return false;
    return (
        ele.scrollTop + ele.clientHeight >= ele.scrollHeight - scrollLap ||
        ele.scrollHeight - scrollLap <= ele.clientHeight
    );
};

function formatTime(timestamp) {
    const date = new Date(parseInt(timestamp));
    const now = new Date();

    // Calculate time difference
    const diffSeconds = Math.floor((now - date) / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);

    // Check if the date is today
    if (date.toDateString() === now.toDateString()) {
        if (diffMinutes < 1) return "Now";
        if (diffMinutes < 60) return `${diffMinutes}min`;
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const period = hours < 12 ? "am" : "pm";
        const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
        const formattedMinutes = minutes.toString().padStart(2, "0");
        return `${formattedHours}:${formattedMinutes}${period}`;
    }

    // Check if the date is within the same week
    if (diffDays < 7) {
        const days = [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday"
        ];
        return days[date.getDay()];
    }

    // Format date as day/month/year with time
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const period = hours < 12 ? "am" : "pm";
    const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
    const formattedMinutes = minutes.toString().padStart(2, "0");
    return `${day}/${month}/${year} ${formattedHours}:${formattedMinutes}${period}`;
}

const currentBarContext = createContext();

const Bar = ({ Content, name }) => {
    const currentBar = useContext(currentBarContext);
    return (
        <div
            className="bar"
            style={{
                display: name == currentBar ? "flex" : "none"
            }}
        >
            {Content}
        </div>
    );
};

const Button = ({ name, click, content, active }) => {
    content ??= name;
    click ??= () => null;
    const currentBar = useContext(currentBarContext);
    active = currentBar == name;
    return (
        <button
            className={active ? "nav active-nav clickable" : "nav clickable"}
            name={name}
            onClick={click}
        >
            {content}
        </button>
    );
};

const Image = ({ src }) => {
    const [loaded, setLoaded] = useState(false);
    const [imgSrc, setImgSrc] = useState(src);
    const [loadTimer, setLoadTimer] = useState(1);

    useEffect(() => {
        if (loaded == "error") {
            setLoadTimer(
                setInterval(() => {
                    setImgSrc(`${src}?t=${Date.now()}`);
                }, 300)
            );
        } else if (loaded == true) {
            clearInterval(loadTimer);
        }
    }, [loaded]);

    return (
        <img
            className={
                loaded == true
                    ? "image"
                    : loaded == "error"
                    ? "error-image image"
                    : "loading-image image"
            }
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded("error")}
            src={imgSrc}
        />
    );
};

const ImagePicker = ({ onSelect, allowed }) => {
    const [imageUrl, setImageUrl] = useState(null);
    const fileInput = useRef();

    const handleChange = e => {
        const file = e.target.files[0];
        if (file) {
            if (onSelect) onSelect(file);
            const url = URL.createObjectURL(file);
            setImageUrl(url);
            e.target.value = [];
        }
    };

    const selectFile = () => {
        if (fileInput.current) {
            setImageUrl(null);
            fileInput.current.click();
        }
    };

    return (
        <div className="imagePicker clickable" onClick={selectFile}>
            <input
                ref={fileInput}
                type="file"
                className="fileInput"
                accept="image/*"
                onChange={handleChange}
                hidden
            />
            {!imageUrl ? (
                <span>Select Image 🖼️</span>
            ) : (
                <Image src={imageUrl} />
            )}
        </div>
    );
};

const Spinner = ({ content, loading = true }) => {
    return loading ? (
        <>
            <div className="spinner"></div>
            <span className="mt-[1rem] text-white font-bold">{content}</span>
        </>
    ) : (
        ""
    );
};

const shortenText = (text, length = 30) => {
    return {
        text: text.length >= length ? `${text.slice(0, length)} ...` : text,
        isShorten: text.length >= length
    };
};

const maxContentToShow = 300;
// post bar
const Post = ({ post, setPosts }) => {
    const { author, _id, image, createdAt, likes, dislikes } = post;
    const [content, setcontent] = useState(
        shortenText(post.content, maxContentToShow)
    );

    const toggleContent = () => {
        const { isShorten, text } = content;
        if (content.isShorten) {
            setcontent({ text: post.content, isShorten: !isShorten });
        } else {
            setcontent(shortenText(post.content, maxContentToShow));
        }
    };

    const [likeTimer, setLikeTimer] = useState(1);
    const likePost = async positive => {
        clearTimeout(likeTimer);
        const timer = setTimeout(async () => {
            const { data } = await axios.post(
                `${endpoints.likePost}?positive=${positive}&_id=${_id}`
            );
            const { liked } = data;
            if (liked) {
                setPosts(posts => {
                    return posts.map(p => {
                        if (p._id == _id) {
                            if (positive) {
                                post.likes += 1;
                            } else {
                                post.dislikes += 1;
                            }
                        }
                        return p;
                    });
                });
            }
        }, timerDelay);
        setLikeTimer(timer);
    };

    const copyPost = _id => {
        navigator.clipboard
            .writeText(`${endpoints.copyPost}?_id=${_id}&type=app`)
            .then(() => {
                alert("post link copied to clipboard, share link to others");
            });
    };

    return (
        <div className={dislikes >= blurDislikes ? "blured post" : "post"}>
            <div className="head">
                <span className="author">{author} </span>
                {navigator.clipboard ? (
                    <span onClick={() => copyPost(_id)} className="copy">
                        copy 📍
                    </span>
                ) : (
                    ""
                )}
            </div>

            {image && image !== "undefined" ? <Image src={image}></Image> : ""}
            <div onClick={toggleContent} className="content">
                {content.text}
            </div>
            <div className="feet">
                <span className="date">Post Time: {formatTime(createdAt)}</span>
                <span
                    onClick={() => likePost(true)}
                    className="likes clickable"
                >
                    ♥️{likes}
                </span>
                <span
                    onClick={() => likePost(false)}
                    className="dislikes clickable"
                >
                    👎 {dislikes}
                </span>
            </div>
        </div>
    );
};

const dummyPost = [
    {
        author: "sadiq stech",

        createdAt: Date.now(),
        _id: Date.now(),
        likes: 100,
        dislikes: 50,
        content: "hmm this is when am coding in phone guys am so tired wlh 😅😅"
    },
    {
        author: "umar",
        _id: Date.now(),
        likes: 100,
        dislikes: 50,
        image: "pic.png",
        createdAt: Date.now(),
        content:
            "hello guys come buy caps🎩 lorem sjsoshs sisjsush http://localhost:7700/frontend/user_dashboard.htmlhttp://localhost:7700/frontend/user_dashboard.html🎩"
    }
];

// must get name if not found
const getAuthorName = () => {
    let authorName = localStorage.getItem("authorName");
    if (authorName) authorName = authorName.slice(0, maxAuthorName);
    return authorName;
};

const App = () => {
    const [currentBar, setCurrentBar] = useState("post");
    const [postContent, setPostContent] = useState("");
    const [postImage, setPostImage] = useState();
    const [authorName, setAuthorName] = useState(getAuthorName());
    const [posting, setPosting] = useState(false);
    const [posts, setPosts] = useState([]);
    const [loadedPost, setLoadedPost] = useState(posts.map(p => p._id));

    const isMaxContentHitted = () => {
        return postContent.length >= maxPostContentLength;
    };

    const postInput = useRef();
    useLayoutEffect(() => {
        const breaks = postContent.split("\n").length;
        if (postInput.current) {
            postInput.current.style.minHeight = breaks >= 3 ? "200px" : "100px";
            postInput.current.style.borderColor = isMaxContentHitted()
                ? "red"
                : "white";
        }
    }, [postContent]);

    const makePost = async () => {
        setPosting(true);
        const postData = {
            createdAt: Date.now(),
            content: postContent,
            author: authorName,
            image: postImage
        };

        const pData = new FormData();
        for (const k in postData) {
            pData.append(k, postData[k]);
        }

        const createPost = async () => {
            try {
                const { data } = await axios.post(endpoints.makePost, pData);
                const { posted, post } = data;
                if (posted) {
                    //  if(post.image) post.image = `${API_BASE_URL}/${post.image}`
                    setPosts(posts => [...posts, post]);
                    setLoadedPost(pts => {
                        pts.push(post._id);
                        return pts;
                    });
                    setCurrentBar("post");
                    setPostContent("");
                    setAuthorName(getAuthorName());
                } else {
                    alert(data.message);
                }
            } catch {
                alert("network error - posting failed");
            } finally {
                setPosting(false);
            }
        };

        createPost();
    };

    // get post
    const postLoadLimit = 20;
    const [loadingPost, setLoadingPost] = useState(false);
    const [fetchTimer, setFetchTimer] = useState(1);
    const fetchPost = async cb => {
        clearTimeout(fetchTimer);
        if (loadingPost) {
            return;
        }
        setLoadingPost(true);

        setFetchTimer(
            setTimeout(async () => {
                try {
                    const { data } = await axios.post(endpoints.loadPost, {
                        limit: postLoadLimit,
                        loadedPost
                    });

                    const { found } = data;

                    let fetchedPost = data.posts
                        .filter(p => !loadedPost.includes(p._id))
                        

                    if (found && fetchedPost.length) {
                        setPosts(pts => {
                            fetchedPost.forEach(post => pts.push(post));
                            return pts;
                        });
                        setLoadedPost(pts => {
                            fetchedPost.forEach(p => pts.push(p._id));
                            return pts;
                        });
                        if (cb) cb();
                    } else if (posts.length == 0) {
                        setTimeout(fetchPost, timerDelay + 300);
                    }
                } catch (err) {
                    console.error("Error loading posts", err);
                    if (posts.length == 0) setTimeout(fetchPost, timerDelay);
                } finally {
                    setLoadingPost(false);
                }
            }, timerDelay)
        );
    };

    const postBar = useRef();

    // for author name
    useEffect(() => {
        localStorage.setItem("authorName", authorName);
    }, [authorName]);

    const [postScrolledEnd, setPostScrolledEnd] = useState(false);
    useEffect(() => {
        postBar.current.onscroll = () => {
            setPostScrolledEnd(scrolledEnd(postBar.current));
        };
    }, [postBar.current]);

    useEffect(() => {
        fetchPost();
    }, []);

    return (
        <currentBarContext.Provider value={currentBar}>
            <div className="header">
                <span className="appName">{appName} </span>
                <div className="navs">
                    <Button name="post" click={() => setCurrentBar("post")} />
                    <Button
                        name="composer"
                        click={() => setCurrentBar("composer")}
                    />
                    <Button
                        name="Go Home"
                        click={() => {
                            location.href = endpoints.homePage;
                        }}
                    />
                </div>
            </div>

            <Bar
                name="post"
                Content={
                    <>
                        <h3 className="title">Post</h3>
                        <div className="posts" ref={postBar}>
                            {posts.length ? (
                                posts.map((p, i) => (
                                    <Post
                                        key={i}
                                        post={p}
                                        setPosts={setPosts}
                                    />
                                ))
                            ) : (
                                <span className="none">
                                    Wait While Post Load ⛔{" "}
                                    {<Spinner loading />}
                                </span>
                            )}
                        </div>
                        {postScrolledEnd || isLargeScreen ? (
                            <button
                                onClick={() => fetchPost()}
                                className={
                                    !loadingPost
                                        ? "loading-btn"
                                        : "loading-btn inactive"
                                }
                            >
                                {!loadingPost ? "Load More" : "Loading More..."}
                            </button>
                        ) : (
                            ""
                        )}
                    </>
                }
            />

            <Bar
                Content={
                    <>
                        <h3 className="title">
                            Post Something To The word ...
                        </h3>
                        <textarea
                            ref={postInput}
                            value={postContent}
                            onChange={e => {
                                if (
                                    !isMaxContentHitted() ||
                                    e.target.value.length < maxPostContentLength
                                ) {
                                    setPostContent(e.target.value);
                                } else if (isMaxContentHitted()) {
                                    setPostContent(prev =>
                                        prev.slice(0, maxPostContentLength)
                                    );
                                }
                                // console.log(e.target.value.length, maxPostContentLength)
                            }}
                            maxLength={maxPostContentLength + 1}
                            placeholder="Enter Your Message"
                            className="composer"
                            row="200"
                        ></textarea>
                        <span
                            className={
                                isMaxContentHitted()
                                    ? "text-red-500 font-bold counter"
                                    : "text-white counter"
                            }
                        >
                            {isMaxContentHitted()
                                ? `Max: ${maxPostContentLength}`
                                : `Remain ${
                                      maxPostContentLength - postContent.length
                                  }`}
                        </span>

                        <ImagePicker
                            allowed="images/*"
                            onSelect={fl => {
                                setPostImage(fl);
                            }}
                        />

                        <input
                            value={authorName}
                            onChange={e => {
                                const v = e.target.value;
                                if (v.length <= maxAuthorName) {
                                    setAuthorName(v);
                                    e.target.style.borderColor = "white";
                                } else {
                                    e.target.style.borderColor = "red";
                                }
                            }}
                            type="text"
                            className="authorInput w-[60%] p-2 self-start text-[.8rem] m-[1rem] mx-[2rem]"
                            placeholder="Enter Author Name, optional..."
                        />
                        {postContent.length < maxPostContentLength &&
                        authorName.length < maxAuthorName &&
                        !posting ? (
                            <button
                                className={
                                    postContent !== "" && authorName !== ""
                                        ? "postBtn clickable"
                                        : "hidden"
                                }
                                onClick={makePost}
                            >
                                Make Post
                            </button>
                        ) : (
                            ""
                        )}

                        <div
                            className={
                                posting ? "loadingBg" : "loadingBg hidden"
                            }
                        >
                            <Spinner content="Making Post 📬" />
                        </div>
                    </>
                }
                name="composer"
            />
        </currentBarContext.Provider>
    );
};

export default App;

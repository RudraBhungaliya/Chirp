import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    avatar: {
      type: String,
      default: "",
    },
    bio : {
        type : String,
        maxlength : 160,
        default : "Hi, I am on Chirp!",
    },
    isActive : {
        type : Boolean,
        default : true,
    },
    lastSeen : {
        type : Date,
    }
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", async function (next){
    if(!this.isModified("password")) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

userSchema.methods.comparePassword = function (curr){
    return bcrypt.compare(curr, this.password);
}

export default mongoose.model("User", userSchema);

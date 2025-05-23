
import { Request, Response } from "express";

/**
 * 
 */
export default class GameController {

    constructor() { };


    static async hello(req: Request, res: Response) {
        try {
            res.status(200).json({
                message: "Hello from GameController"
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    };


}